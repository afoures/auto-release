import { unlink } from "node:fs/promises";
import type { AutoReleaseConfig, VersionStrategy } from "../types.js";
import { get_current_version, write_version } from "../packages.js";
import { discover_all_changes } from "../changes.js";
import { write_changelog, get_changelog_path } from "../changelog.js";
import { create_logger } from "../utils/logger.js";
import { confirm } from "../utils/prompts.js";

export interface ReleaseOptions {
  config: AutoReleaseConfig;
  cwd?: string;
  app?: string;
  dry_run?: boolean;
  yes?: boolean;
}

/**
 * Release apps with pending changes
 */
export async function release(options: ReleaseOptions): Promise<void> {
  const {
    config,
    cwd = process.cwd(),
    app: app_filter,
    dry_run = false,
    yes = false,
  } = options;
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
    strategy: VersionStrategy;
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
    return;
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
    return;
  }

  // Confirm
  if (!yes) {
    const confirmed = await confirm("Proceed with release?", false);
    if (!confirmed) {
      logger.info("Release cancelled");
      return;
    }
  }

  // Execute releases
  for (const rel of releases) {
    logger.info(`\nReleasing ${rel.app.name}...`);

    // Update package.json versions
    await write_version(rel.app, rel.next_version, cwd);
    logger.success(`Updated version in ${rel.app.packages.length} package(s)`);

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
}
