import type { Root } from "mdast";

export type Change<kind extends string> = {
  kind: kind;
  title: string;
  description: string[];
};

export type Formatter<
  change_kinds extends string,
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
  transform_markdown(tree: Root): parsed_changelog;
  /**
   * The changelog content will be sorted by version in ascending order automatically.
   */
  format_changelog(changelog: NoInfer<parsed_changelog>): Array<string>;
  generate_release_notes(args: {
    from_version: string;
    to_version: string;
    changes: Change<change_kinds>[];
  }): Array<string>;
};

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
};
