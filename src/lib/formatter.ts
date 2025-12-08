import type { Change, Formatter } from "./types.js";

export type ChangelogFormatter<change_kinds extends string = string> =
  Formatter<
    change_kinds,
    {
      root: { title: string; description: string[] };
      releases: Array<{
        version: string;
        changes: Array<Change<change_kinds>>;
      }>;
    }
  >;

export function default_changelog_formatter<change_kinds extends string>({
  kind_map,
}: {
  kind_map?: Record<NoInfer<change_kinds>, string>;
} = {}): (allowed_changes: readonly change_kinds[]) => Formatter<
  change_kinds,
  {
    root: { title: string; description: string[] };
    releases: Array<{
      version: string;
      changes: Array<Change<change_kinds>>;
    }>;
  }
> {
  return (allowed_changes) => ({
    transform_markdown(tree) {
      return {
        root: { title: "", description: [] },
        releases: [],
      };
    },
    format_changelog(changelog) {
      return changelog.releases.map((release) => {
        return `## ${release.version}\n\n${release.changes
          .map((change) => `- ${change.title}`)
          .join("\n")}`;
      });
    },
    generate_release_notes({ changes }) {
      return changes.map((change) => {
        return `- ${change.title}`;
      });
    },
  });
}
