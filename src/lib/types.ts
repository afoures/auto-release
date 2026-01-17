/**
 * Core types for auto-release
 */

import type { Component, ResolvedComponent } from "./components/types.ts";
import type { GitPlatformClient } from "./platforms/types.ts";
import type { VersionManager, Formatter, ChangeKindDisplayMap } from "./versioning/types.ts";

export type {
  GitPlatformClient,
  VersionManager,
  Formatter,
  Component,
  ResolvedComponent,
  ChangeKindDisplayMap,
};

export type Pretty<T> = { [key in keyof T]: T[key] } & {};

/**
 * Logger interface for structured output
 */
export interface Logger {
  note(title: string, message: string): void;
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
    platform: GitPlatformClient;
    target_branch?: string;
    default_release_branch_prefix?: string;
    tag_generator?: (args: { project: { name: string }; version: string }) => string;
  };
  projects: Record<string, ProjectDefinition>;
}

/**
 * Project definition
 */
export interface ProjectDefinition {
  components: Array<Component>;
  versioning: VersionManager;
  changelog: string;
}

export type ManagedProject = {
  name: string;
  components: Array<ResolvedComponent>;
  versioning: VersionManager;
  changelog: string;
};
