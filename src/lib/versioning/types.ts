import type { Root } from "mdast";
import type { ChangeFile } from "../change-file.ts";

export type Formatter<
  change_kinds extends string = string,
  parsed_changelog extends {
    releases: Array<{
      version: string;
      changes: Array<ChangeFile<change_kinds>>;
    }>;
  } = {
    releases: Array<{
      version: string;
      changes: Array<ChangeFile<change_kinds>>;
    }>;
  },
> = {
  /**
   * Transform the mdast tree into a custom changelog data structure.
   * @param tree - The markdown tree to transform
   */
  transform_markdown(tree: Root): parsed_changelog;
  /**
   * Format the changelog data into markdown.
   * The changelog releases will be sorted by version in ascending order automatically.
   * @param changelog - The parsed changelog to format
   * @returns Markdown string that will be written to the changelog file
   */
  format_changelog(
    changelog: NoInfer<parsed_changelog>,
    context: {
      app: { name: string };
    },
  ): string;
  /**
   * Generate pull/merge request body content.
   * @param options - The options for generating the PR body
   * @returns Markdown string for PR body
   */
  generate_pr_body(options: {
    app: { name: string };
    current_version: string;
    next_version: string;
    changes: ChangeFile<change_kinds>[];
  }): string;
  /**
   * Generate release notes for a given app to use in GitHub/GitLab release bodies.
   * @param options - The options for generating release notes
   * @returns Markdown string for release body
   */
  generate_release_notes(options: {
    app: { name: string; changelog: string };
    version: string;
  }): string;
};

export type ChangeKindDisplayMap<change_kind extends string> = Record<
  NoInfer<change_kind>,
  { singular: string; plural: string }
>;

export type VersionManager<
  change_kind extends string = string,
  parsed_changelog extends {
    releases: Array<{
      version: string;
      changes: Array<ChangeFile<change_kind>>;
    }>;
  } = {
    releases: Array<{
      version: string;
      changes: Array<ChangeFile<change_kind>>;
    }>;
  },
> = {
  allowed_changes: readonly change_kind[];
  initial_version: string;
  compare(a: string, b: string): -1 | 0 | 1;
  validate({ version }: { version: string }): boolean;
  bump(args: { version: string; changes: Array<ChangeFile<change_kind>>; date: Date }): string;
  formatter: Formatter<change_kind, parsed_changelog>;
  display_map: ChangeKindDisplayMap<change_kind>;
};
