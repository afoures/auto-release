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
 * Version strategy interface for parsing, formatting, and bumping versions
 */
export interface VersionStrategy {
  id: string;
  change_types: readonly string[];
  parse(version: string): unknown;
  format(parsed: unknown): string;
  bump(options: {
    current_version: string;
    changes: ResolvedChange[];
    now: Date;
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
  path?: string;
}

/**
 * Versioning configuration for an app
 */
export interface VersioningConfig {
  strategy: string | VersionStrategy;
  change_types: readonly string[];
}

/**
 * App configuration
 */
export interface AppConfig {
  name: string;
  packages: string[];
  versioning: VersioningConfig;
  changelog?: ChangelogConfig;
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
  default_changelog_dir?: string;
  version_strategies?: Record<string, VersionStrategy>;
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
