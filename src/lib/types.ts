/**
 * Core types for auto-release
 */

import type { Component } from "./components/index.js";
import type { GitProvider } from "./providers/types.js";
import type { VersioningStrategy, ResolvedChange } from "./versioning/types.js";

export type { GitProvider, VersioningStrategy, ResolvedChange };

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
 * App configuration
 */
export interface AppConfig {
  name: string;
  packages?: string[];
  components?: Array<Component>;
  versioning: VersioningStrategy;
  changelog: string;
}

/**
 * Auto-release configuration
 */
export interface AutoReleaseConfig {
  changes_dir?: string;
  git: {
    provider: GitProvider;
    default_target_branch?: string;
    default_release_branch_prefix?: string;
  };
  apps: AppConfig[];
}

export type NormalizedConfig = {
  changes_dir: string;
  git: {
    provider: GitProvider;
    default_target_branch: string;
    default_release_branch_prefix: string;
  };
  apps: AppConfig[];
};

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
