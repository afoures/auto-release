/**
 * Core types for auto-release
 */

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
 * Auto-release configuration
 */
export interface AutoReleaseConfig {
  changes_dir?: string;
  git: {
    provider: GitProvider;
    default_target_branch?: string;
    default_release_branch_prefix?: string;
  };
  apps: Record<string, AppDefinition>;
}

/**
 * App definition
 */
export interface AppDefinition {
  components: Array<Component>;
  versioning: VersionManager;
  changelog: string;
}

/**
 * Normalized auto-release configuration
 */
export type NormalizedConfig = {
  changes_dir: string;
  git: {
    provider: GitProvider;
    default_target_branch: string;
    default_release_branch_prefix: string;
  };
  apps: Array<InternalAppDefinition>;
};

export type InternalAppDefinition = AppDefinition & {
  name: string;
};
