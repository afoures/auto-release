import { relative, resolve } from "node:path";
import {
  discover_all_changes,
  discover_all_changes_with_metadata,
} from "../changes.js";
import { create_logger } from "../utils/logger.js";
import { create_command } from "../cli.js";
import type { FileChange } from "../providers/types.js";
import type { ManagedApplication } from "../types.js";
import { find_nearest_config } from "../config.js";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

async function get_current_version(app: ManagedApplication): Promise<string> {
  const versions = new Set<string>();

  for (const component of app.components) {
    for (const part of component.parts) {
      versions.add(part.get_current_version());
    }
  }

  if (versions.size === 0) {
    throw new Error(`App "${app.name}" has no components`);
  }

  if (versions.size > 1) {
    throw new Error(
      `App "${app.name}" has mismatched versions: ${Array.from(versions).join(
        ", "
      )}`
    );
  }

  return versions.values().next().value as string;
}

export const generate_release = create_command({
  name: "generate-release",
  description: "Create or update release PRs from change files",
  schema: {
    app: {
      type: "string",
      description: "Filter by app name",
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would be done without making changes",
    },
    config: {
      type: "string",
      description: "Path to config file",
    },
  },
  get_context: async ({ args, cwd }) => {
    const { config, root_dir } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config, root_dir };
  },
  run: async ({ args, context }) => {
    const cwd = context.root_dir;
    const app_filter = args.app;
    const dry_run = args["dry-run"] ?? false;

    const config = context.config;

    const logger = create_logger();
    const provider = config.git.provider;
    const release_branch_prefix = config.git.default_release_branch_prefix;

    // Discover all changes
    let changes_map: Map<string, any>;
    try {
      changes_map = await discover_all_changes(
        config.managed_applications,
        config.changes_dir
      );
    } catch (error: any) {
      return {
        status: "error" as const,
        error: `Failed to discover changes: ${error.message}`,
      };
    }

    // Filter apps if specified
    const target_apps = app_filter
      ? config.managed_applications.filter((app) => app.name === app_filter)
      : config.managed_applications;

    if (app_filter && target_apps.length === 0) {
      return {
        status: "error" as const,
        error: `App "${app_filter}" not found in config`,
      };
    }

    // Process each app with pending changes
    const releases: Array<{
      app: ManagedApplication;
      current_version: string;
      next_version: string;
      changes: typeof changes_map extends Map<string, infer C> ? C : never;
      release_branch: string;
    }> = [];

    for (const app of target_apps) {
      const app_name = app.name;
      const changes = changes_map.get(app_name) || [];

      if (changes.length === 0) {
        continue;
      }

      try {
        const current_version = await get_current_version(app);
        const strategy = app.versioning;

        const next_version = strategy.bump({
          version: current_version,
          changes,
          date: new Date(),
        });

        // Determine release branch name
        const release_branch = `${release_branch_prefix}/${app_name}`;

        releases.push({
          app,
          current_version,
          next_version,
          changes,
          release_branch,
        });
      } catch (error: any) {
        return {
          status: "error" as const,
          error: `Failed to get version for ${app_name}: ${error.message}`,
        };
      }
    }

    if (releases.length === 0) {
      logger.info("No pending changes to release");
      return {
        status: "success" as const,
        message: "No pending changes to release",
      };
    }

    // Display plan
    logger.info("Release PR plan:\n");
    for (const rel of releases) {
      logger.info(`📦 ${rel.app.name}`);
      logger.info(`  Version: ${rel.current_version} → ${rel.next_version}`);
      logger.info(`  Branch: ${rel.release_branch}`);
      logger.info(`  Changes: ${rel.changes.length} file(s)`);
      logger.info("");
    }

    if (dry_run) {
      logger.info("✨ Dry run - no changes will be made");
      return {
        status: "success" as const,
        message: "Dry run completed - no changes were made",
      };
    }

    // Get default branch (only needed for actual operations, not dry-run)
    const default_branch = config.git.default_target_branch;
    let default_branch_sha: string;
    try {
      default_branch_sha = await provider.get_branch_sha(default_branch);
    } catch (error: any) {
      return {
        status: "error" as const,
        error: `Failed to get branch SHA for ${default_branch}: ${error.message}`,
      };
    }

    // Process each release
    const errors: string[] = [];
    for (const release of releases) {
      logger.info(`\nPreparing release for ${release.app.name}...`);

      try {
        const changelog_path = resolve(cwd, release.app.changelog);
        const changelog_relative_path = relative(cwd, changelog_path);
        const existing_changelog = await provider.get_file_content(
          changelog_relative_path,
          default_branch
        );

        const file_changes: FileChange[] = [];

        for (const component of release.app.components) {
          for (const part of component.parts) {
            const part_relative_path = relative(cwd, part.path);
            const current_content = await provider.get_file_content(
              part_relative_path,
              default_branch
            );

            if (!current_content) {
              errors.push(
                `Could not read ${part_relative_path} from ${default_branch}`
              );
              continue;
            }

            let updated_content = current_content;
            try {
              const parsed = JSON.parse(current_content);
              if (parsed.version !== undefined) {
                parsed.version = release.next_version;
                updated_content = JSON.stringify(parsed, null, 2) + "\n";
              }
            } catch {
              // Non-JSON files are skipped; component-specific handling would be needed
            }

            file_changes.push({
              path: part_relative_path,
              content: updated_content,
            });
          }
        }

        if (errors.length > 0) {
          continue;
        }

        const formatter = release.app.versioning.formatter;
        const parsed_changelog = formatter.transform_markdown(
          existing_changelog
            ? fromMarkdown(existing_changelog, {
                extensions: [gfm()],
                mdastExtensions: [gfmFromMarkdown()],
              })
            : { type: "root", children: [] }
        );

        const releases = [
          { version: release.next_version, changes: release.changes },
          ...parsed_changelog.releases.filter(
            (existing_release) =>
              existing_release.version !== release.next_version
          ),
        ];

        releases.sort((a, b) =>
          release.app.versioning.compare(a.version, b.version)
        );

        const changelog_content = formatter.format_changelog({
          ...parsed_changelog,
          releases,
        } as typeof parsed_changelog);
        const updated_changelog = `${changelog_content.trimEnd()}\n`;

        file_changes.push({
          path: changelog_relative_path,
          content: updated_changelog,
        });

        // Delete change files - need to discover changes with metadata
        const changes_with_metadata = await discover_all_changes_with_metadata(
          [release.app],
          config.changes_dir
        );
        const app_changes = changes_with_metadata.get(release.app.name) || [];
        for (const change of app_changes) {
          const change_relative_path = relative(cwd, change.file_path);
          file_changes.push({
            path: change_relative_path,
            content: null, // null = delete
          });
        }

        // Create or update branch
        const commit_message = `chore: release ${release.app.name} ${release.next_version}`;
        await provider.create_or_update_branch(
          release.release_branch,
          default_branch_sha,
          file_changes,
          commit_message
        );
        logger.success(`Updated branch: ${release.release_branch}`);

        const pr_title = `chore: release ${release.app.name} ${release.next_version}`;
        const pr_body = formatter.generate_pr_body({
          app: release.app,
          current_version: release.current_version,
          next_version: release.next_version,
          changes: release.changes,
        });

        // Find existing PR or create new one
        const existing_pr = await provider.find_pull_request(
          release.release_branch
        );
        if (existing_pr) {
          await provider.update_pull_request(
            existing_pr.number,
            pr_title,
            pr_body
          );
          logger.success(
            `Updated PR #${existing_pr.number}: ${existing_pr.url}`
          );
        } else {
          const pr = await provider.create_pull_request(
            release.release_branch,
            default_branch,
            pr_title,
            pr_body
          );
          logger.success(`Created PR #${pr.number}: ${pr.url}`);
        }
      } catch (error: any) {
        errors.push(
          `Failed to prepare release for ${release.app.name}: ${error.message}`
        );
      }
    }

    if (errors.length > 0) {
      return {
        status: "error" as const,
        error: errors.join("; "),
      };
    }

    logger.success("\n✨ Release PRs prepared!");
    return {
      status: "success" as const,
      message: "Release PRs prepared successfully",
    };
  },
});
