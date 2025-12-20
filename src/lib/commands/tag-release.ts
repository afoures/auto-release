import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import type { ManagedApplication } from "../types.ts";
import * as git from "../utils/git.ts";
import { compute_current_version } from "../utils/version.ts";
import { relative } from "node:path";

/**
 * Get the version of an app at a specific git revision
 */
async function get_app_version_at_revision(
  app: ManagedApplication,
  root: string,
  revision: string,
): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
  try {
    const version =
      (await compute_current_version(app, {
        get_file_content: (file_path: string) => {
          const relative_path = relative(root, file_path);
          return git.read_file_at_revision(root, revision, relative_path);
        },
      })) ?? app.versioning.initial_version;

    // Validate version format
    if (!app.versioning.validate({ version })) {
      return {
        ok: false,
        error: `Invalid version format for ${app.name} at revision ${revision}: ${version}`,
      };
    }

    return { ok: true, version };
  } catch (error: any) {
    return {
      ok: false,
      error: `Failed to get version for ${app.name} at revision ${revision}: ${error.message}`,
    };
  }
}

export const tag_release = create_command({
  name: "tag-release",
  description: "Detect version changes and create git tags and releases",
  schema: {
    config: {
      type: "string",
      description: "Path to config file",
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
  run: async ({ args: { "dry-run": dry_run = false }, context: { config, root } }) => {
    const logger = create_logger();

    // Get HEAD and parent commit SHAs
    const { head_sha, parent_sha: base_sha } = await git.get_head_and_parent_shas(root);

    if (base_sha === null) {
      return {
        status: "success" as const,
        message: "HEAD has no parent commit - nothing to tag",
      };
    }

    const changed_apps: Array<{
      app: ManagedApplication;
      head_version: string;
      base_version: string;
    }> = [];

    // Detect apps with version changes
    for (const app of config.managed_applications) {
      const head_result = await get_app_version_at_revision(app, root, head_sha);
      if (!head_result.ok) {
        return {
          status: "error" as const,
          error: `Failed to get HEAD version for ${app.name}: ${head_result.error}`,
        };
      }

      const base_result = await get_app_version_at_revision(app, root, base_sha);
      if (!base_result.ok) {
        return {
          status: "error" as const,
          error: `Failed to get base version for ${app.name}: ${base_result.error}`,
        };
      }

      if (head_result.version !== base_result.version) {
        changed_apps.push({
          app,
          head_version: head_result.version,
          base_version: base_result.version,
        });
      }
    }

    if (changed_apps.length === 0) {
      return {
        status: "success" as const,
        message: "No version changes detected",
      };
    }

    // Log detected changes
    logger.info(`Detected version changes in ${changed_apps.length} app(s):`);
    for (const { app, head_version, base_version } of changed_apps) {
      logger.info(`  ${app.name}: ${base_version} → ${head_version}`);
    }

    if (dry_run) {
      logger.info("\nDry run - would create tags and releases:");
      for (const { app, head_version } of changed_apps) {
        const tag = `${app.name}@${head_version}`;
        logger.info(`  - Tag: ${tag}`);
        logger.info(`  - Release: ${tag}`);
      }
      return {
        status: "success" as const,
        message: "Dry run completed - no changes were made",
      };
    }

    // Create tags and releases
    const tagged_apps: string[] = [];
    const errors: string[] = [];

    for (const { app, head_version } of changed_apps) {
      const tag = `${app.name}@${head_version}`;

      try {
        // Check if tag already exists via platform API (more reliable than local git)
        const existing_tag = await config.git.platform.get_tag({ tag });
        if (existing_tag !== null) {
          if (existing_tag.commit_sha === head_sha) {
            logger.info(`Tag ${tag} already exists on commit ${head_sha} - skipping`);
            tagged_apps.push(tag);
            continue;
          } else {
            errors.push(
              `Tag ${tag} already exists but points to different commit (${existing_tag.commit_sha} vs ${head_sha})`,
            );
            continue;
          }
        }

        // Create remote tag
        await config.git.platform.create_tag({
          tag,
          commit_sha: head_sha,
          message: `release: ${tag}`,
        });

        // Create release
        await config.git.platform.create_release({
          tag,
          release: {
            name: tag,
            body: app.versioning.formatter.generate_release_notes({
              app: {
                name: app.name,
                changelog: app.changelog,
              },
              version: head_version,
            }),
          },
        });

        tagged_apps.push(tag);
        logger.success(`Tagged and released ${tag}`);
      } catch (error: any) {
        errors.push(`Failed to tag/release ${tag}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      return {
        status: "error" as const,
        error: errors.join("; "),
      };
    }

    const summary =
      tagged_apps.length === 1
        ? `Tagged 1 app: ${tagged_apps[0]}`
        : `Tagged ${tagged_apps.length} apps: ${tagged_apps.join(", ")}`;

    return {
      status: "success" as const,
      message: summary,
    };
  },
});
