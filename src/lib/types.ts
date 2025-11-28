/**
 * Core types for auto-release
 */

import type { GitProvider } from "./providers/types.js";
import type { VersioningStrategy } from "./versioning/types.js";

/**
 * Git provider interface (re-exported from providers for use in GitConfig)
 */
export type { GitProvider };

/**
 * Versioning configuration for an app - just the strategy
 */
export type { VersioningStrategy };

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
 * App configuration
 */
export interface AppConfig {
  name: string;
  packages: string[];
  versioning: VersioningStrategy;
  changelog: ChangelogConfig;
  deploy?: DeployConfig;
}

/**
 * Git configuration
 */
export interface GitConfig {
  provider: GitProvider;
  tag_template?: string;
  release_branch_prefix?: string;
}

/**
 * Auto-release configuration
 */
export interface AutoReleaseConfig {
  apps: AppConfig[];
  changes_dir?: string;
  git: GitConfig; // Now required
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
