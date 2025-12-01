export type Change<type extends string> = {
  kind: type;
  title: string;
  description?: string;
};

export type VersionManager<change_types extends string> = {
  validate({ version }: { version: string }): boolean;
  bump(args: {
    version: string;
    changes: Array<Change<change_types>>;
    date: Date;
  }): string;
};

export type ChangelogVersion<change_types extends string> = {
  version: string;
  changes: Array<Change<change_types>>;
};

export type ChangelogContent<change_types extends string> = {
  versions: Array<ChangelogVersion<change_types>>;
};

export type ChangelogFormatter<
  change_types extends string,
  changelog_content extends ChangelogContent<change_types>
> = {
  parse(args: {
    text: Array<string>;
    change_types: change_types[];
  }): changelog_content;
  /**
   * The changelog content will be sorted by version in ascending order automatically.
   */
  format(args: {
    changelog: NoInfer<changelog_content>;
    change_types: change_types[];
  }): Array<string>;
};

export type VersioningStrategy<
  args extends {
    change_types: string;
    changelog_content: ChangelogContent<any>;
  }
> = {
  change_types: ReadonlyArray<args["change_types"]>;
  version_manager: VersionManager<args["change_types"]>;
  changelog_formatter: ChangelogFormatter<
    args["change_types"],
    args["changelog_content"]
  >;
};

export function create_versioning_strategy<
  const change_type extends string,
  changelog_content extends ChangelogContent<change_type>
>(
  strategy: VersioningStrategy<{
    change_types: change_type;
    changelog_content: changelog_content;
  }>
): typeof strategy {
  return strategy;
}
