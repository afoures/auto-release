import { relative } from "node:path";
import { get_current_version } from "../packages.js";
import {
  discover_all_changes,
  discover_all_changes_with_metadata,
} from "../changes.js";
import {
  generate_updated_changelog,
  get_changelog_path,
} from "../changelog.js";
import { generate_release_notes } from "../release-notes.js";
import { create_logger } from "../utils/logger.js";
import { create_command } from "../cli.js";
import type { FileChange } from "../providers/types.js";
import type { ManagedApplication } from "../types.js";
import { find_nearest_config } from "../config.js";

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
        const current_version = await get_current_version(app, cwd);
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
    for (const rel of releases) {
      logger.info(`\nPreparing release for ${rel.app.name}...`);

      try {
        // Fetch current files from default branch
        const changelog_path = get_changelog_path(rel.app, cwd);

        // Read current changelog
        const changelog_relative_path = relative(cwd, changelog_path);
        const existing_changelog = await provider.get_file_content(
          changelog_relative_path,
          default_branch
        );

        // Generate updated files
        const file_changes: FileChange[] = [];

        // Update component files
        // Components define parts that need version updates
        // We read current content from provider, update version, and write back
        for (const component of rel.app.components) {
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

            // Update version in content
            // For JSON files (package.json, etc.), parse and update version field
            let updated_content = current_content;
            try {
              const parsed = JSON.parse(current_content);
              if (parsed.version !== undefined) {
                parsed.version = rel.next_version;
                updated_content = JSON.stringify(parsed, null, 2) + "\n";
              }
            } catch {
              // Not JSON - for other file types, components would handle this
              // but since we're working with provider content, we can't use update_version
              // For now, skip non-JSON files or implement component-specific logic
              // This is a limitation that may need component-specific handlers
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

        // Update changelog
        const updated_changelog = generate_updated_changelog({
          existing_content: existing_changelog,
          app: rel.app,
          current_version: rel.current_version,
          next_version: rel.next_version,
          date: new Date(),
          changes: rel.changes,
        });
        file_changes.push({
          path: changelog_relative_path,
          content: updated_changelog,
        });

        // Delete change files - need to discover changes with metadata
        const changes_with_metadata = await discover_all_changes_with_metadata(
          [rel.app],
          config.changes_dir
        );
        const app_changes = changes_with_metadata.get(rel.app.name) || [];
        for (const change of app_changes) {
          const change_relative_path = relative(cwd, change.file_path);
          file_changes.push({
            path: change_relative_path,
            content: null, // null = delete
          });
        }

        // Create or update branch
        const commit_message = `chore: release ${rel.app.name} ${rel.next_version}`;
        await provider.create_or_update_branch(
          rel.release_branch,
          default_branch_sha,
          file_changes,
          commit_message
        );
        logger.success(`Updated branch: ${rel.release_branch}`);

        // Generate PR title and body
        const pr_title = `chore: release ${rel.app.name} ${rel.next_version}`;
        const pr_body = generate_release_notes({
          app: rel.app,
          current_version: rel.current_version,
          next_version: rel.next_version,
          changes: rel.changes,
        });

        // Find existing PR or create new one
        const existing_pr = await provider.find_pull_request(
          rel.release_branch
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
            rel.release_branch,
            default_branch,
            pr_title,
            pr_body
          );
          logger.success(`Created PR #${pr.number}: ${pr.url}`);
        }
      } catch (error: any) {
        errors.push(
          `Failed to prepare release for ${rel.app.name}: ${error.message}`
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
