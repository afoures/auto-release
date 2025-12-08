import type { Change, Formatter } from "./types.js";
import type { ChangeKindDisplayMap } from "./versioning/types.js";

export function default_formatter<change_kinds extends string>({
  allowed_changes,
  display_map,
}: {
  allowed_changes: readonly change_kinds[];
  display_map?: ChangeKindDisplayMap<change_kinds>;
}): Formatter<
  change_kinds,
  {
    root: { title: string; description: string[] };
    releases: Array<{
      version: string;
      changes: Array<Change<change_kinds>>;
    }>;
  }
> {
  return {
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
  };
}
