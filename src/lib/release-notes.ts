import type { AppConfig, Change, VersionManager } from "./types.js";
import { generate_changelog_section } from "./changelog.js";

/**
 * Generate release notes for PR body
 */
export function generate_release_notes(options: {
  app: AppConfig<any>;
  current_version: string;
  next_version: string;
  changes: Change<any>[];
  versioning: VersionManager<any>;
}): string {
  const { app, current_version, next_version, changes } = options;

  let notes = `## Release ${app.name} ${next_version}\n\n`;
  notes += `**Version bump:** ${current_version} → ${next_version}\n\n`;

  // Group changes by type
  const grouped = new Map<string, Change<any>[]>();
  for (const change of changes) {
    if (!grouped.has(change.kind)) {
      grouped.set(change.kind, []);
    }
    grouped.get(change.kind)!.push(change);
  }

  // Order types according to strategy's change_types order
  const ordered_types = options.versioning.allowed_changes.filter((kind) =>
    grouped.has(kind)
  );

  if (ordered_types.length === 0) {
    notes += "No changes in this release.\n";
    return notes;
  }

  for (const type of ordered_types) {
    const type_changes = grouped.get(type)!;
    const capitalized_type =
      type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    notes += `### ${capitalized_type}\n\n`;
    for (const change of type_changes) {
      notes += `- ${change.title}\n`;
      if (change.description.length > 0) {
        const indented_description = change.description
          .map((line) => `  ${line}`)
          .join("\n");
        notes += `${indented_description}\n`;
      }
    }
    notes += "\n";
  }

  return notes.trimEnd() + "\n";
}

/**
 * Generate release body for GitHub/GitLab releases
 */
export function generate_release_body(options: {
  app: AppConfig<any>;
  current_version: string;
  next_version: string;
  date: Date;
  changes: Change<any>[];
  versioning: VersionManager<any>;
}): string {
  // Use the changelog section format for releases
  return generate_changelog_section(options);
}
