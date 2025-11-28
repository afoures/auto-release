import { resolve, relative } from "node:path";
import { get_current_version, resolve_packages } from "../packages.js";
import { discover_all_changes } from "../changes.js";
import { generate_updated_changelog, get_changelog_path } from "../changelog.js";
import { generate_release_notes } from "../release-notes.js";
import { create_logger } from "../utils/logger.js";
import { create_command } from "../cli.js";
import type { FileChange } from "../providers/types.js";

export const prepare_release = create_command({
  name: "prepare-release",
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
  run: async ({ values, config }) => {
    const cwd = process.cwd();
    const app_filter = values.app;
    const dry_run = values["dry-run"] ?? false;
    const logger = create_logger();
    const provider = config.git.provider;
    const release_branch_prefix = config.git.release_branch_prefix || "autorelease";

    // Discover all changes
    const changes_map = await discover_all_changes(
      config.apps,
      config.changes_dir!
    );

    // Filter apps if specified
    const target_apps = app_filter
      ? config.apps.filter((a) => a.name === app_filter)
      : config.apps;

    if (app_filter && target_apps.length === 0) {
      throw new Error(`App "${app_filter}" not found in config`);
    }

    // Get default branch
    const default_branch = await provider.get_default_branch();
    const default_branch_sha = await provider.get_branch_sha(default_branch);

    // Process each app with pending changes
    const releases: Array<{
      app: (typeof target_apps)[0];
      current_version: string;
      next_version: string;
      changes: typeof changes_map extends Map<string, infer C> ? C : never;
      release_branch: string;
    }> = [];

    for (const app of target_apps) {
      const changes = changes_map.get(app.name) || [];

      if (changes.length === 0) {
        continue;
      }

      const current_version = await get_current_version(app, cwd);
      const strategy = app.versioning;

      const next_version = strategy.bump({
        current_version,
        changes,
        time: { now: () => new Date() },
      });

      // Determine release branch name
      const release_branch = app.release_branch || `${release_branch_prefix}/${app.name}`;

      releases.push({
        app,
        current_version,
        next_version,
        changes,
        release_branch,
      });
    }

    if (releases.length === 0) {
      logger.info("No pending changes to release");
      return { ok: true as const };
    }

    // Display plan
    logger.info("Release PR plan:\n");
    for (const rel of releases) {
      logger.info(`📦 ${rel.app.name}`);
      logger.info(`  Version: ${rel.current_version} → ${rel.next_version}`);
      logger.info(`  Branch: ${rel.release_branch}`);
      logger.info(`  Changes: ${rel.changes.length} file(s)\n`);
    }

    if (dry_run) {
      logger.info("Dry run - no changes will be made");
      return { ok: true as const };
    }

    // Process each release
    for (const rel of releases) {
      logger.info(`\nPreparing release for ${rel.app.name}...`);

      try {
        // Fetch current files from default branch
        const packages = await resolve_packages(rel.app, cwd);
        const changelog_path = get_changelog_path(rel.app, cwd);

        // Read current package.json files
        const package_files: Array<{ path: string; content: string }> = [];
        for (const pkg of packages) {
          const relative_path = relative(cwd, pkg.path);
          const content = await provider.get_file_content(
            relative_path,
            default_branch
          );
          if (!content) {
            throw new Error(`Could not read ${relative_path} from ${default_branch}`);
          }
          package_files.push({ path: relative_path, content });
        }

        // Read current changelog
        const changelog_relative_path = relative(cwd, changelog_path);
        const existing_changelog = await provider.get_file_content(
          changelog_relative_path,
          default_branch
        );

        // Generate updated files
        const file_changes: FileChange[] = [];

        // Update package.json files
        for (const pkg_file of package_files) {
          const package_json = JSON.parse(pkg_file.content);
          package_json.version = rel.next_version;
          file_changes.push({
            path: pkg_file.path,
            content: JSON.stringify(package_json, null, 2) + "\n",
          });
        }

        // Update changelog
        const updated_changelog = generate_updated_changelog({
          existing_content: existing_changelog,
          app: rel.app,
          current_version: rel.current_version,
          next_version: rel.next_version,
          date: new Date(),
          changes: rel.changes,
          strategy: rel.app.versioning,
        });
        file_changes.push({
          path: changelog_relative_path,
          content: updated_changelog,
        });

        // Delete change files
        for (const change of rel.changes) {
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
          strategy: rel.app.versioning,
        });

        // Find existing PR or create new one
        const existing_pr = await provider.find_pull_request(rel.release_branch);
        if (existing_pr) {
          await provider.update_pull_request(
            existing_pr.number,
            pr_title,
            pr_body
          );
          logger.success(`Updated PR #${existing_pr.number}: ${existing_pr.url}`);
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
        logger.error(`Failed to prepare release for ${rel.app.name}: ${error.message}`);
        throw error;
      }
    }

    logger.success("\n✨ Release PRs prepared!");
    return { ok: true as const };
  },
});

