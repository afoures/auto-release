import type { Content, Heading, List, ListItem, Root } from "mdast";
import type { Change, Formatter } from "./types.js";
import type { ChangeKindDisplayMap } from "./versioning/types.js";

type DefaultParsedChangelog<change_kinds extends string> = {
  root: { title: string; description: string[] };
  releases: Array<{
    version: string;
    changes: Array<Change<change_kinds>>;
  }>;
};

function to_plain_text(node: Content | Root): string {
  if ("children" in node && Array.isArray(node.children)) {
    return node.children
      .map((child) => to_plain_text(child as Content))
      .join("");
  }
  if (
    "value" in node &&
    typeof (node as { value?: unknown }).value === "string"
  ) {
    return (node as { value: string }).value;
  }
  return "";
}

function normalize_label(label: string): string {
  return label.trim().toLowerCase();
}

function resolve_change_kind<change_kinds extends string>({
  heading_text,
  allowed_changes,
  display_map,
}: {
  heading_text: string;
  allowed_changes: readonly change_kinds[];
  display_map: ChangeKindDisplayMap<change_kinds>;
}): change_kinds | null {
  const normalized = normalize_label(heading_text);

  for (const kind of allowed_changes) {
    if (normalize_label(kind) === normalized) {
      return kind;
    }

    const labels = display_map[kind];
    const singular = labels?.singular ?? kind;
    const plural = labels?.plural ?? singular;
    if (
      normalize_label(singular) === normalized ||
      normalize_label(plural) === normalized
    ) {
      return kind;
    }
  }

  return null;
}

function extract_list_item_text(item: ListItem): {
  title: string;
  description: string[];
} {
  const text = to_plain_text(item).trim();
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const [title, ...description] = lines;
  return { title: title ?? "", description };
}

function create_empty_changelog<
  change_kinds extends string
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
    allowed_changes.reduce((map, kind) => {
      const label = kind.charAt(0).toUpperCase() + kind.slice(1);
      map[kind] = { singular: label, plural: `${label}s` };
      return map;
    }, {} as ChangeKindDisplayMap<change_kinds>);

  return {
    transform_markdown(tree: Root) {
      const changelog = create_empty_changelog<change_kinds>();

      let current_release:
        | DefaultParsedChangelog<change_kinds>["releases"][number]
        | null = null;
      let current_kind: change_kinds | null = null;

      const push_current_release = () => {
        if (current_release) {
          changelog.releases.push(current_release);
        }
      };

      for (const node of tree.children) {
        if (node.type === "heading" && (node as Heading).depth === 1) {
          changelog.root.title = to_plain_text(node).trim();
          continue;
        }

        if (node.type === "heading" && (node as Heading).depth === 2) {
          push_current_release();
          current_kind = null;

          const heading_text = to_plain_text(node).trim();
          const version = heading_text.split(/\s+/)[0] ?? "";
          current_release = { version, changes: [] };
          continue;
        }

        if (node.type === "heading" && (node as Heading).depth === 3) {
          const heading_text = to_plain_text(node).trim();
          current_kind = resolve_change_kind({
            heading_text,
            allowed_changes,
            display_map: resolved_display_map,
          });
          continue;
        }

        if (node.type === "list" && current_release) {
          const kind_for_items =
            current_kind ?? allowed_changes[0] ?? ("default" as change_kinds);
          for (const item of (node as List).children) {
            const { title, description } = extract_list_item_text(item);
            if (!title) {
              continue;
            }
            current_release.changes.push({
              kind: kind_for_items,
              title,
              description,
            });
          }
          continue;
        }

        if (!current_release && node.type === "paragraph") {
          const text = to_plain_text(node).trim();
          if (text) {
            changelog.root.description.push(text);
          }
        }
      }

      push_current_release();

      return changelog;
    },
    format_changelog(changelog) {
      const lines: string[] = [];

      if (changelog.root.title) {
        lines.push(`# ${changelog.root.title}`);
      }
      if (changelog.root.description.length > 0) {
        lines.push(changelog.root.description.join("\n"));
      }

      for (const release of changelog.releases) {
        const release_lines: string[] = [`## ${release.version}`];

        for (const change_kind of allowed_changes) {
          const kind_changes = release.changes.filter(
            (change) => change.kind === change_kind
          );
          if (kind_changes.length === 0) {
            continue;
          }

          const labels = resolved_display_map[change_kind];
          const heading = labels?.plural ?? labels?.singular ?? change_kind;
          release_lines.push(`### ${heading}`);

          for (const change of kind_changes) {
            release_lines.push(`- ${change.title}`);
            for (const line of change.description) {
              release_lines.push(`  ${line}`);
            }
          }
        }

        lines.push(release_lines.join("\n"));
      }

      return lines.join("\n\n");
    },
    generate_release_notes({ app, next_version, changes }) {
      return build_grouped_sections({
        title: `Release ${app.name} ${next_version}`,
        allowed_changes,
        display_map: resolved_display_map,
        changes,
      }).join("\n");
    },
    generate_pr_body({ app, current_version, next_version, changes }) {
      return build_grouped_sections({
        title: `Release ${app.name} ${next_version}`,
        version_line: `Version: ${current_version} → ${next_version}`,
        allowed_changes,
        display_map: resolved_display_map,
        changes,
      }).join("\n");
    },
  };
}

function build_grouped_sections<change_kinds extends string>({
  title,
  version_line,
  allowed_changes,
  display_map,
  changes,
}: {
  title: string;
  version_line?: string;
  allowed_changes: readonly change_kinds[];
  display_map: ChangeKindDisplayMap<change_kinds>;
  changes: Array<Change<change_kinds>>;
}): string[] {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  if (version_line) {
    lines.push(version_line);
  }

  const grouped = new Map<change_kinds, Array<Change<change_kinds>>>();
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

    const labels = display_map[kind];
    const heading = labels?.plural ?? labels?.singular ?? kind;
    lines.push("");
    lines.push(`## ${heading}`);
    for (const change of items) {
      lines.push(`- ${change.title}`);
      for (const line of change.description) {
        lines.push(`  ${line}`);
      }
    }
  }

  if (grouped.size === 0) {
    lines.push("");
    lines.push("No changes in this release.");
  }

  return lines;
}
