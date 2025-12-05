/**
 * Core types for auto-release
 */

import type { Root } from "mdast";
import type { Component } from "./components/types.js";
import type { GitProvider } from "./providers/types.js";
import type { VersionManager, Change, Formatter } from "./versioning/types.js";

export type { GitProvider, VersionManager, Change, Formatter, Component };

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
export interface AppConfig<change_kind extends string> {
  packages?: string[];
  components?: Array<Component>;
  versioning: VersionManager<change_kind>;
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
  apps: Record<string, AppConfig<any>>;
}

export type NormalizedConfig = {
  changes_dir: string;
  git: {
    provider: GitProvider;
    default_target_branch: string;
    default_release_branch_prefix: string;
  };
  apps: Record<string, AppConfig<any>>;
};

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
