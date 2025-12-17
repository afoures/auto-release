import { relative } from "node:path";
import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import type { ManagedApplication } from "../types.ts";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

function build_release_body({
  app,
  version,
  changelog_content,
}: {
  app: ManagedApplication;
  version: string;
  changelog_content: string | null;
}): string {
  const formatter = app.versioning.formatter;

  if (!changelog_content) {
    return `Release ${app.name} ${version}`;
  }

  const parsed_changelog: ReturnType<typeof formatter.transform_markdown> =
    formatter.transform_markdown(
      fromMarkdown(changelog_content, {
        extensions: [gfm()],
        mdastExtensions: [gfmFromMarkdown()],
      }),
    );

  const release = parsed_changelog.releases.find((item) => item.version === version);

  if (!release) {
    return `Release ${app.name} ${version}`;
  }

  return `${formatter
    .generate_release_notes({
      app: { name: app.name },
      current_version: version,
      next_version: version,
      changes: release.changes,
    })
    .trimEnd()}\n`;
}

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
  get_context: async ({ args, cwd }) => {
    const { config, git_root } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config, git_root };
  },
  run: async ({ args, context }) => {
    const app_filter = args.app;
    const branch_name = args.branch;
    const config = context.config;
    const logger = create_logger();
    const provider = config.git.provider;
    const release_branch_prefix = config.git.default_release_branch_prefix;

    if (!context.git_root) {
      return {
        status: "error" as const,
        error: "Could not determine git root",
      };
    }

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
      const app = config.managed_applications.find((item) => item.name === app_filter);
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
            (item) => `${release_branch_prefix}/${item.name}` === branch_name,
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
      logger.warn("No app or branch specified. Publishing all apps (this may not be intended)");
      target_apps = config.managed_applications;
    }

    // Process each app
    const errors: string[] = [];
    for (const app of target_apps) {
      const app_name = app.name;
      logger.info(`\nPublishing release for ${app_name}...`);

      try {
        // Get current version from components
        const current_version = app.current_version;
        logger.info(`Version: ${current_version}`);

        // Get changelog content for release notes
        const changelog_relative_path = relative(context.git_root, app.changelog);
        const changelog_content = await provider.get_file_content(
          changelog_relative_path,
          default_branch,
        );

        const release_body = build_release_body({
          app,
          version: current_version,
          changelog_content,
        });

        // Create git tag
        const tag_name = `${app_name}@${current_version}`;
        await provider.create_tag(tag_name, default_branch_sha, release_body);
        logger.success(`Created tag: ${tag_name}`);

        // Create release
        const release_name = `${app_name} ${current_version}`;
        await provider.create_release(tag_name, release_name, release_body);
        logger.success(`Created release: ${release_name}`);
      } catch (error: any) {
        errors.push(`Failed to publish release for ${app_name}: ${error.message}`);
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
