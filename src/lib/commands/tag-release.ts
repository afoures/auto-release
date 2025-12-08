import { relative } from "node:path";
import { get_current_version } from "../packages.js";
import { get_changelog_path } from "../changelog.js";
import { create_logger } from "../utils/logger.js";
import { create_command } from "../cli.js";
import type { ManagedApplication } from "../types.js";

export const tag_release = create_command({
  name: "tag-release",
  description: "Create git tags and releases after release PR merge",
  schema: {
    app: {
      type: "string",
      description: "App name (if not provided, will try to detect from branch)",
    },
    branch: {
      type: "string",
      description: "Branch name to detect app from (default: detect from git)",
    },
    config: {
      type: "string",
      description: "Path to config file",
    },
  },
  run: async ({ args, get_config }) => {
    const cwd = process.cwd();
    const app_filter = args.app;
    const branch_name = args.branch;
    const config = await get_config();
    const logger = create_logger();
    const provider = config.git.provider;
    const release_branch_prefix = config.git.default_release_branch_prefix;

    // Get default branch
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

    let target_apps: Array<ManagedApplication> = [];

    // If app is specified, use it
    if (app_filter) {
      const app = config.managed_applications.find(
        (item) => item.name === app_filter
      );
      if (!app) {
        return {
          status: "error" as const,
          error: `App "${app_filter}" not found in config`,
        };
      }
      target_apps = [app];
    } else if (branch_name) {
      // Try to detect app from branch name
      // Expected format: release/{app_name} or custom/{app_name}
      const branch_parts = branch_name.split("/");
      if (branch_parts.length >= 2) {
        const app_name = branch_parts.slice(1).join("/"); // Handle nested app names
        const app =
          config.managed_applications.find((item) => item.name === app_name) ||
          config.managed_applications.find(
            (item) => `${release_branch_prefix}/${item.name}` === branch_name
          );
        if (app) {
          target_apps = [app];
        }
      }
      if (target_apps.length === 0) {
        return {
          status: "error" as const,
          error: `Could not detect app from branch "${branch_name}". Please specify --app`,
        };
      }
    } else {
      // No app or branch specified - publish all apps that have been released
      // This is a fallback - ideally CI should pass branch name
      logger.warn(
        "No app or branch specified. Publishing all apps (this may not be intended)"
      );
      target_apps = config.managed_applications;
    }

    // Process each app
    const errors: string[] = [];
    for (const app of target_apps) {
      const app_name = app.name;
      logger.info(`\nPublishing release for ${app_name}...`);

      try {
        // Get current version from components
        const current_version = await get_current_version(app, cwd);
        logger.info(`Version: ${current_version}`);

        // Get changelog content for release notes
        const changelog_path = get_changelog_path(app, cwd);
        const changelog_relative_path = relative(cwd, changelog_path);
        const changelog_content = await provider.get_file_content(
          changelog_relative_path,
          default_branch
        );

        // Extract release notes from changelog
        let release_body = `Release ${app_name} ${current_version}`;
        if (changelog_content) {
          // Extract the first release section (most recent)
          const lines = changelog_content.split("\n");
          let in_release_section = false;
          let release_lines: string[] = [];

          // Find the version header
          for (let i = 0; i < lines.length; i++) {
            if (
              lines[i].match(
                new RegExp(
                  `^## ${current_version.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                  )}`
                )
              )
            ) {
              in_release_section = true;
              release_lines.push(lines[i]);
              continue;
            }
            if (in_release_section) {
              // Stop at next release section
              if (lines[i].match(/^## /)) {
                break;
              }
              release_lines.push(lines[i]);
            }
          }

          if (release_lines.length > 0) {
            release_body = release_lines.join("\n").trim();
          }
        }

        // Create git tag
        const tag_name = `${app_name}@${current_version}`;
        await provider.create_tag(tag_name, default_branch_sha, release_body);
        logger.success(`Created tag: ${tag_name}`);

        // Create release
        const release_name = `${app_name} ${current_version}`;
        await provider.create_release(tag_name, release_name, release_body);
        logger.success(`Created release: ${release_name}`);
      } catch (error: any) {
        errors.push(
          `Failed to publish release for ${app_name}: ${error.message}`
        );
      }
    }

    if (errors.length > 0) {
      return {
        status: "error" as const,
        error: errors.join("; "),
      };
    }

    logger.success("\n✨ Release published!");
    return {
      status: "success" as const,
      message: "Release published successfully",
    };
  },
});
