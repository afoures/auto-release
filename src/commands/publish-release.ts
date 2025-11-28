import { resolve, relative } from "node:path";
import { get_current_version, resolve_packages } from "../packages.js";
import { get_changelog_path } from "../changelog.js";
import { generate_release_body } from "../release-notes.js";
import { create_logger } from "../utils/logger.js";
import { create_command } from "../cli.js";

/**
 * Format git tag using template
 */
function format_tag(
  config: { git?: { tag_template?: string } },
  app_name: string,
  version: string
): string {
  const template = config.git?.tag_template || "${appName}@${version}";
  return template.replace("${appName}", app_name).replace("${version}", version);
}

export const publish_release = create_command({
  name: "publish-release",
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
  run: async ({ values, config }) => {
    const cwd = process.cwd();
    const app_filter = values.app;
    const branch_name = values.branch;
    const logger = create_logger();
    const provider = config.git.provider;
    const release_branch_prefix = config.git.release_branch_prefix || "autorelease";

    // Get default branch
    const default_branch = await provider.get_default_branch();
    const default_branch_sha = await provider.get_branch_sha(default_branch);

    let target_apps = config.apps;

    // If app is specified, use it
    if (app_filter) {
      target_apps = config.apps.filter((a) => a.name === app_filter);
      if (target_apps.length === 0) {
        throw new Error(`App "${app_filter}" not found in config`);
      }
    } else if (branch_name) {
      // Try to detect app from branch name
      // Expected format: autorelease/{app_name} or custom/{app_name}
      const branch_parts = branch_name.split("/");
      if (branch_parts.length >= 2) {
        const app_name = branch_parts.slice(1).join("/"); // Handle nested app names
        target_apps = config.apps.filter((a) => a.name === app_name);
        if (target_apps.length === 0) {
          // Try matching by release branch name
          target_apps = config.apps.filter(
            (a) =>
              (a.release_branch || `${release_branch_prefix}/${a.name}`) ===
              branch_name
          );
        }
      }
      if (target_apps.length === 0) {
        throw new Error(
          `Could not detect app from branch "${branch_name}". Please specify --app`
        );
      }
    } else {
      // No app or branch specified - publish all apps that have been released
      // This is a fallback - ideally CI should pass branch name
      logger.warn(
        "No app or branch specified. Publishing all apps (this may not be intended)"
      );
    }

    // Process each app
    for (const app of target_apps) {
      logger.info(`\nPublishing release for ${app.name}...`);

      try {
        // Get current version from default branch (after PR merge)
        const packages = await resolve_packages(app, cwd);
        const package_path = relative(cwd, packages[0].path);
        const package_content = await provider.get_file_content(
          package_path,
          default_branch
        );

        if (!package_content) {
          throw new Error(`Could not read ${package_path} from ${default_branch}`);
        }

        const package_json = JSON.parse(package_content);
        const version = package_json.version;

        if (!version) {
          throw new Error(`No version found in ${package_path}`);
        }

        logger.info(`Version: ${version}`);

        // Get changelog content for release notes
        const changelog_path = get_changelog_path(app, cwd);
        const changelog_relative_path = relative(cwd, changelog_path);
        const changelog_content = await provider.get_file_content(
          changelog_relative_path,
          default_branch
        );

        // Extract release notes from changelog
        let release_body = `Release ${app.name} ${version}`;
        if (changelog_content) {
          // Extract the first release section (most recent)
          const lines = changelog_content.split("\n");
          let in_release_section = false;
          let release_lines: string[] = [];
          let release_start = 0;

          // Find the version header
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(new RegExp(`^## ${version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))) {
              release_start = i;
              in_release_section = true;
              release_lines.push(lines[i]);
              continue;
            }
            if (in_release_section) {
              // Stop at next release section
              if (lines[i].match(/^## \d+\.\d+\.\d+/)) {
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
        const tag_name = format_tag(config, app.name, version);
        await provider.create_tag(tag_name, default_branch_sha, release_body);
        logger.success(`Created tag: ${tag_name}`);

        // Create release
        const release_name = `${app.name} ${version}`;
        await provider.create_release(tag_name, release_name, release_body);
        logger.success(`Created release: ${release_name}`);
      } catch (error: any) {
        logger.error(`Failed to publish release for ${app.name}: ${error.message}`);
        throw error;
      }
    }

    logger.success("\n✨ Release published!");
    return { ok: true as const };
  },
});

