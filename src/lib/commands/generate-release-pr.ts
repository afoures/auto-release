import { join } from "node:path";
import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import * as git from "../utils/git.ts";
import * as fs from "../utils/fs.ts";
import { compute_current_version } from "../utils/version.ts";
import { ChangeFile, find_change_files } from "../change-file.ts";
import * as mdast from "../utils/mdast.ts";

export const generate_release_pr = create_command({
  name: "generate-release-pr",
  description: "Create or update release PRs from change files",
  schema: {
    config: {
      type: "string",
      description: "Path to config file",
    },
    filter: {
      type: "string",
      description: "Only generate release PRs for the specified apps",
      multiple: true,
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would be done without making changes",
    },
  },
  get_context: async ({ args, cwd }) => {
    const { config, git_root } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config, root: git_root || config.folder };
  },
  run: async ({ args: { filter, "dry-run": dry_run = false }, context: { config, root } }) => {
    const logger = create_logger();

    const filtered_applications = filter
      ? config.managed_applications.filter((app) => filter.includes(app.name))
      : config.managed_applications;

    if (filtered_applications.length === 0) {
      return {
        status: "success" as const,
        message: "No apps to release",
      };
    }

    for (const app of filtered_applications) {
      const changes_dir = join(config.changes_dir, app.name);
      const changes = await find_change_files(changes_dir, {
        allowed_kinds: app.versioning.allowed_changes,
      });

      if (changes.warnings.length > 0) {
        for (const warning of changes.warnings) {
          logger.warn(warning);
        }
      }

      const current_version =
        (await compute_current_version(app, {
          get_file_content: (file_path: string) => fs.read_file(file_path),
        })) ?? app.versioning.initial_version;

      const next_version = app.versioning.bump({
        version: current_version,
        changes: changes.list,
        date: new Date(),
      });

      // Group changes by kind
      const changes_by_kind = new Map<string, Array<ChangeFile<any>>>();
      for (const change of changes.list) {
        const existing = changes_by_kind.get(change.kind) ?? [];
        existing.push(change);
        changes_by_kind.set(change.kind, existing);
      }

      // Build formatted message
      const message_lines: string[] = [];
      const display_map = app.versioning.display_map;

      for (const [kind, kind_changes] of changes_by_kind.entries()) {
        const label = display_map[kind]?.plural ?? display_map[kind]?.singular ?? kind;
        message_lines.push(`\n${label}:`);
        for (const change of kind_changes) {
          message_lines.push(`  • ${change.summary}`);
        }
      }

      logger.note(`Release ${app.name} ${next_version}`, message_lines.join("\n"));

      if (dry_run) {
        continue;
      }

      // delete change files
      await fs.delete_all_files_from_folder(changes_dir);

      // run all component updates
      for (const component of app.components) {
        for (const part of component.parts) {
          const initial_content = await fs.read_file(part.file);
          if (initial_content === null) {
            continue;
          }
          const updated_content = part.update_version(initial_content, next_version);
          await fs.write_file(part.file, updated_content);
        }
        // TODO: implement component "after" hook
      }

      const formatter = app.versioning.formatter;

      // update changelog
      const initial_changelog_content = await fs.read_file(app.changelog);
      const changelog_as_mdast = mdast.parse_markdown(initial_changelog_content ?? "");
      const changelog = formatter.transform_markdown(
        changelog_as_mdast,
        initial_changelog_content ?? "",
      );
      const updated_changelog_content = formatter.format_changelog(
        {
          ...changelog,
          releases: [
            { version: next_version, changes: changes.list },
            ...changelog.releases.filter((release) => release.version !== next_version),
          ].sort((a, b) => app.versioning.compare(b.version, a.version)),
        },
        {
          app: { name: app.name },
        },
      );
      await fs.write_file(app.changelog, updated_changelog_content);

      // git diff then reset
      const file_operations = await git.diff(root);
      await git.reset(root);

      const platform = config.git.platform;
      const release_branch_name = `${config.git.default_release_branch_prefix}/${app.name}`;

      // create or update branch
      await platform.create_or_update_branch({
        branch_name: release_branch_name,
        base_branch_name: config.git.target_branch,
        file_operations,
        commit_message: `chore: prepare release ${app.name}@${next_version}`,
      });

      // create or update PR
      await platform.create_or_update_pull_request({
        head_branch_name: release_branch_name,
        base_branch_name: config.git.target_branch,
        title: `release: ${app.name}@${next_version}`,
        body: formatter.generate_pr_body({
          app: { name: app.name },
          current_version,
          next_version,
          changes: changes.list,
        }),
        draft: true,
      });
    }

    if (dry_run) {
      return {
        status: "success" as const,
        message: "Dry run completed - no changes were made",
      };
    }

    return {
      status: "success" as const,
      message: "Release PRs generated successfully",
    };
  },
});
