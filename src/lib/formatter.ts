import type { Heading, Root } from "mdast";
import type { Formatter } from "./versioning/types.ts";
import type { ChangeKindDisplayMap } from "./versioning/types.ts";
import { ChangeFile } from "./change-file.ts";
import * as mdast from "./utils/mdast.ts";

type DefaultParsedChangelog<change_kinds extends string> = {
  root: { title: string; description: string[] };
  releases: Array<{
    version: string;
    changes: Array<ChangeFile<change_kinds>>;
    // Present only for releases parsed from an existing changelog: the raw markdown
    // body of the release, re-emitted verbatim so past releases survive round-trips.
    raw_body?: string;
  }>;
};

function create_empty_changelog<
  change_kinds extends string,
>(): DefaultParsedChangelog<change_kinds> {
  return {
    root: { title: "", description: [] },
    releases: [],
  };
}

export function default_formatter<change_kinds extends string>({
  allowed_changes,
  display_map,
}: {
  allowed_changes: readonly change_kinds[];
  display_map?: ChangeKindDisplayMap<change_kinds>;
}): Formatter<change_kinds, DefaultParsedChangelog<change_kinds>> {
  const resolved_display_map =
    display_map ??
    allowed_changes.reduce(
      (map, kind) => {
        const label = kind.charAt(0).toUpperCase() + kind.slice(1);
        map[kind] = { singular: label, plural: `${label}s` };
        return map;
      },
      {} as ChangeKindDisplayMap<change_kinds>,
    );

  return {
    transform_markdown(tree: Root, original_text: string) {
      const changelog = create_empty_changelog<change_kinds>();

      let current_release: DefaultParsedChangelog<change_kinds>["releases"][number] | null = null;
      let release_body_start = 0;

      // Capture the raw markdown body of the current release (everything between the end of
      // its `## version` heading and the start of the next release / end of file) verbatim,
      // so past releases survive the parse → re-serialize round-trip untouched.
      const finalize_release = (body_end: number) => {
        if (current_release) {
          current_release.raw_body = original_text.slice(release_body_start, body_end).trim();
          changelog.releases.push(current_release);
        }
      };

      for (const node of tree.children) {
        if (node.type === "heading" && (node as Heading).depth === 1) {
          changelog.root.title = mdast.as_text(node);
          continue;
        }

        if (node.type === "heading" && (node as Heading).depth === 2) {
          finalize_release(node.position?.start.offset ?? original_text.length);

          const heading_text = mdast.to_plain_text(node).trim();
          const version = heading_text.split(/\s+/)[0] ?? "";
          current_release = { version, changes: [] };
          release_body_start = node.position?.end.offset ?? 0;
          continue;
        }

        if (!current_release && node.type === "paragraph") {
          const text = mdast.as_text(node);
          if (text) {
            changelog.root.description.push(text);
          }
        }
      }

      finalize_release(original_text.length);

      return changelog;
    },
    format_changelog(changelog, context) {
      const lines: string[] = [];

      if (changelog.root.title) {
        lines.push(changelog.root.title, "");
      } else {
        lines.push(`# \`${context.project.name}\` changelog`, "");
      }
      if (changelog.root.description.length > 0) {
        lines.push(changelog.root.description.join("\n"), "");
      } else {
        lines.push(`This is the changelog for \`${context.project.name}\`.`, "");
      }

      for (const release of changelog.releases) {
        // Releases parsed from an existing changelog are re-emitted verbatim. The trailing
        // "" mirrors the grouped branch below so consecutive releases stay separated by a
        // blank line once the blocks are joined.
        if (typeof release.raw_body === "string") {
          lines.push([`## ${release.version}`, "", release.raw_body, ""].join("\n"));
          continue;
        }

        const release_lines = [`## ${release.version}`, ""];

        for (const change_kind of allowed_changes) {
          const kind_changes = release.changes.filter((change) => change.kind === change_kind);
          if (kind_changes.length === 0) {
            continue;
          }

          const labels = resolved_display_map[change_kind];
          const heading = labels?.plural ?? labels?.singular ?? change_kind;
          release_lines.push(`### ${heading}`, "");

          for (const change of kind_changes) {
            release_lines.push(change.summary, "");
          }
        }

        if (release.changes.length === 0) {
          release_lines.push("No changes in this release.", "");
        }

        lines.push(release_lines.join("\n"));
      }

      return lines.join("\n");
    },
    generate_release_notes({ project, version }) {
      const hash = version.replaceAll(".", "");
      const file = `${project.changelog}#${hash}`;
      return `See the changelog for release notes: [${project.name}@${version}](${file})`;
    },
    generate_pr_body({ project, current_version, next_version, changes }) {
      const lines: string[] = [];
      // Note: Header is added by the command, not here
      lines.push(`# Automated release for \`${project.name}\``);
      lines.push(`Version: \`${current_version}\` → \`${next_version}\``);

      lines.push("");
      lines.push("## Changelog");

      const grouped = new Map<change_kinds, Array<ChangeFile<change_kinds>>>();
      for (const change of changes) {
        const group = grouped.get(change.kind) ?? [];
        group.push(change);
        grouped.set(change.kind, group);
      }

      for (const kind of allowed_changes) {
        const items = grouped.get(kind);
        if (!items || items.length === 0) {
          continue;
        }

        const labels = resolved_display_map[kind];
        const heading = labels?.plural ?? labels?.singular ?? kind;
        lines.push("");
        lines.push(`### ${heading}`);
        for (const change of items) {
          lines.push(change.summary);
          lines.push("");
        }
      }

      if (grouped.size === 0) {
        lines.push("");
        lines.push("No changes in this release.");
      }

      return lines.join("\n");
    },
  };
}
