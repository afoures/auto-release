/**
 * Core types for auto-release
 */

import type { GitProvider } from "./providers/types.js";
import type { VersioningStrategy, ResolvedChange } from "./versioning/types.js";

export type { GitProvider, VersioningStrategy, ResolvedChange };

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

export interface ChangelogFormatter {
  template?: (args: { app_name: string }) => Array<string>;
  release?: (args: {
    version: string;
    date: Date;
    changes: Array<ResolvedChange>;
  }) => Array<string>;
}

/**
 * Changelog configuration for an app
 */
export interface ChangelogConfig {
  path: string;
  formatter?: ChangelogFormatter;
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

export type NormalizedConfig = {
  apps: AppConfig[];
  changes_dir: string;
  git: Required<GitConfig>;
};

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
