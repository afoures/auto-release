import { unlink } from "node:fs/promises";
import { get_current_version, write_version } from "../packages.js";
import { discover_all_changes } from "../changes.js";
import { write_changelog, get_changelog_path } from "../changelog.js";
import { create_logger } from "../utils/logger.js";
import { confirm, isCancel } from "@clack/prompts";
import { create_command } from "../cli.js";

export const release = create_command({
  name: "release",
  description: "Release apps with pending changes",
  schema: {
    app: {
      type: "string",
      description: "Filter by app name",
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would be done without making changes",
    },
    yes: {
      type: "boolean",
      description: "Skip confirmation prompt",
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
    const yes = values.yes ?? false;
    const logger = create_logger();

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

    // Compute releases
    const releases: Array<{
      app: (typeof target_apps)[0];
      current_version: string;
      next_version: string;
      changes: typeof changes_map extends Map<string, infer C> ? C : never;
      strategy: (typeof target_apps)[0]["versioning"];
      changelog_path: string;
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

      const changelog_path = get_changelog_path(
        app,
        config.default_changelog_dir!,
        cwd
      );

      releases.push({
        app,
        current_version,
        next_version,
        changes,
        strategy,
        changelog_path,
      });
    }

    if (releases.length === 0) {
      logger.info("No pending changes to release");
      return { ok: true as const };
    }

    // Display plan
    logger.info("Release plan:\n");
    for (const rel of releases) {
      logger.info(`📦 ${rel.app.name}`);
      logger.info(`  Version: ${rel.current_version} → ${rel.next_version}`);
      logger.info(`  Packages: ${rel.app.packages.join(", ")}`);
      logger.info(`  Changelog: ${rel.changelog_path}`);
      logger.info(`  Changes: ${rel.changes.length} file(s)\n`);
    }

    if (dry_run) {
      logger.info("Dry run - no changes will be made");
      return { ok: true as const };
    }

    // Confirm
    if (!yes) {
      const confirmed = await confirm({
        message: "Proceed with release?",
        initialValue: false,
      });
      if (isCancel(confirmed) || !confirmed) {
        logger.info("Release cancelled");
        return { ok: true as const };
      }
    }

    // Execute releases
    for (const rel of releases) {
      logger.info(`\nReleasing ${rel.app.name}...`);

      // Update package.json versions
      await write_version(rel.app, rel.next_version, cwd);
      logger.success(
        `Updated version in ${rel.app.packages.length} package(s)`
      );

      // Write changelog
      await write_changelog({
        app: rel.app,
        current_version: rel.current_version,
        next_version: rel.next_version,
        date: new Date(),
        changes: rel.changes,
        strategy: rel.strategy,
        changelog_path: rel.changelog_path,
      });
      logger.success(`Updated changelog: ${rel.changelog_path}`);

      // Delete change files
      for (const change of rel.changes) {
        await unlink(change.file_path);
      }
      logger.success(`Removed ${rel.changes.length} change file(s)`);
    }

    logger.success("\n✨ Release complete!");
    return { ok: true as const };
  },
});
