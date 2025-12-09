import type { Root } from "mdast";

export type Change<kind extends string> = {
  kind: kind;
  title: string;
  description: string[];
};

export type Formatter<
  change_kinds extends string = string,
  parsed_changelog extends {
    releases: Array<{
      version: string;
      changes: Array<Change<change_kinds>>;
    }>;
  } = {
    releases: Array<{
      version: string;
      changes: Array<Change<change_kinds>>;
    }>;
  }
> = {
  /**
   * Transform the mdast tree into a custom changelog data structure.
   * @param tree - The markdown tree to transform
   */
  transform_markdown(tree: Root): parsed_changelog;
  /**
   * Format the changelog data into an renderable markdown strings.
   * The changelog releases will be sorted by version in ascending order automatically.
   * @param changelog - The parsed changelog to format
   * @returns An array of strings that will be written to the changelog file
   */
  format_changelog(changelog: NoInfer<parsed_changelog>): Array<string>;
  /**
   * Generate release notes for a given app that will be written to the release pull/merge request body
   * @param options - The options for generating release notes
   * @returns An array of strings that will be written to the release pull/merge request body
   */
  generate_release_notes(options: {
    app: { name: string };
    current_version: string;
    next_version: string;
    changes: Change<change_kinds>[];
  }): Array<string>;
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
      changes: Array<Change<change_kind>>;
    }>;
  } = {
    releases: Array<{
      version: string;
      changes: Array<Change<change_kind>>;
    }>;
  }
> = {
  allowed_changes: readonly change_kind[];
  compare(a: string, b: string): -1 | 0 | 1;
  validate({ version }: { version: string }): boolean;
  bump(args: {
    version: string;
    changes: Array<Change<change_kind>>;
    date: Date;
  }): string;
  formatter: Formatter<change_kind, parsed_changelog>;
  display_map: ChangeKindDisplayMap<change_kind>;
};
