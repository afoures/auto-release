/**
 * Core types for auto-release
 */

/**
 * A resolved change file with parsed metadata
 */
export interface ResolvedChange {
  app_name: string;
  type: string;
  title: string;
  body?: string;
  file_path: string;
}

/**
 * Version strategy interface for determining version bumps
 */
export interface VersionStrategy {
  change_types: readonly string[];
  bump(options: {
    current_version: string;
    changes: ResolvedChange[];
    time: { now: () => Date };
  }): string;
}

/**
 * Deploy configuration for an app
 */
export interface DeployConfig {
  command?: string;
  handler?: (context: DeployContext) => void | Promise<void>;
}

/**
 * Context passed to deploy handler
 */
export interface DeployContext {
  app: AppConfig;
  current_version: string;
  packages: Array<{ path: string; package_json: any }>;
  dry_run: boolean;
  logger: Logger;
  exec: (command: string) => Promise<{ stdout: string; stderr: string }>;
}

/**
 * Logger interface for structured output
 */
export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  success(message: string): void;
}

/**
 * Changelog configuration for an app
 */
export interface ChangelogConfig {
  path: string;
}

/**
 * Versioning configuration for an app - just the strategy
 */
export type VersioningConfig = VersionStrategy;

/**
 * App configuration
 */
export interface AppConfig {
  name: string;
  packages: string[];
  versioning: VersioningConfig;
  changelog: ChangelogConfig;
  deploy?: DeployConfig;
}

/**
 * Git configuration
 */
export interface GitConfig {
  tag_template?: string;
}

/**
 * Auto-release configuration
 */
export interface AutoReleaseConfig {
  apps: AppConfig[];
  changes_dir?: string;
  git?: GitConfig;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
