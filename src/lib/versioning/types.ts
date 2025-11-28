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
export interface VersioningStrategy {
  change_types: readonly string[];
  bump(options: {
    current_version: string;
    changes: ResolvedChange[];
    time: { now: () => Date };
  }): string;
}
