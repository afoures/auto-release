import { relative } from "node:path";
import { discover_changes_with_metadata_bis, type ChangeWithMetadata } from "../changes.ts";
import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { readFile, writeFile } from "node:fs/promises";
import type { ManagedApplication } from "../types.ts";
import * as git from "../utils/git.ts";

export const generate_release = create_command({
  name: "generate-release",
  description: "Create or update release PRs from change files",
  schema: {
    config: {
      type: "string",
      description: "Path to config file",
    },
    app: {
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
    if (!git_root) {
      throw new Error("Could not determine git root");
    }
    return { config, git_root };
  },
  run: async ({
    args: { app: filter, "dry-run": dry_run = false },
    context: { config, git_root },
  }) => {
    const logger = create_logger();

    const releases: Array<{
      app: ManagedApplication;
      changes: Array<ChangeWithMetadata<any>>;
      next_version: string;
    }> = [];

    for (const app of config.managed_applications) {
      if (filter && !filter.includes(app.name)) {
        continue;
      }

      const changes = await discover_changes_with_metadata_bis(app, config.changes_dir);
      const next_version = app.versioning.bump({
        version: app.current_version,
        changes,
        date: new Date(),
      });

      releases.push({
        app,
        changes,
        next_version,
      });
    }

    if (releases.length === 0) {
      return {
        status: "success" as const,
        message: "No apps to release",
      };
    }

    for (const release of releases) {
      const { app, changes, next_version } = release;
      logger.note(
        `Release ${app.name} ${next_version}`,
        changes.map((change) => `${change.kind} ${change.title} in ${change.file_path}`).join("\n"),
      );
    }

    if (dry_run) {
      return {
        status: "success" as const,
        message: "Dry run completed - no changes were made",
      };
    }

    for (const release of releases) {
      const { app, changes, next_version } = release;

      // run all component updates
      for (const component of app.components) {
        for (const part of component.parts) {
          const relative_path = relative(git_root, part.file);
          const initial_content = await readFile(relative_path, "utf-8");
          const updated_content = part.update_version(initial_content, next_version);
          await writeFile(relative_path, updated_content);
        }
        // TODO: implement component "after" hook
      }

      const formatter = app.versioning.formatter;

      // update changelog
      const changelog_relative_path = relative(git_root, app.changelog);
      const initial_changelog_content = await readFile(changelog_relative_path, "utf-8");
      const changelog_as_mdast = fromMarkdown(initial_changelog_content, {
        extensions: [gfm()],
        mdastExtensions: [gfmFromMarkdown()],
      });
      const changelog = formatter.transform_markdown(changelog_as_mdast);
      const updated_changelog_content = formatter.format_changelog({
        ...changelog,
        releases: [
          { version: next_version, changes },
          ...changelog.releases.filter((release) => release.version !== next_version),
        ].sort((a, b) => app.versioning.compare(a.version, b.version)),
      });
      await writeFile(changelog_relative_path, updated_changelog_content);

      // git diff
      const file_operations = await git.diff(git_root);
      // git reset
      await git.reset(git_root);

      const platform = config.git.platform;
      const release_branch_name = `${config.git.default_release_branch_prefix}/${app.name}`;

      // create or update branch
      await platform.create_or_update_branch({
        branch_name: release_branch_name,
        base_branch_name: config.git.default_target_branch,
        file_operations,
        commit_message: `chore: release ${app.name} ${next_version}`,
      });

      // create or update PR
      await platform.create_or_update_pull_request({
        head_branch_name: release_branch_name,
        base_branch_name: config.git.default_target_branch,
        title: `chore: release ${app.name} ${next_version}`,
        body: formatter.generate_pr_body({
          app: { name: app.name },
          current_version: app.current_version,
          next_version,
          changes,
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
