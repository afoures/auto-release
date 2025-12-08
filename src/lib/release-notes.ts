import type { AppDefinition, Change } from "./types.js";
import { generate_changelog_section } from "./changelog.js";

/**
 * Generate release notes for PR body
 */
export function generate_release_notes(options: {
  app: AppDefinition;
  app_name: string;
  current_version: string;
  next_version: string;
  changes: Change<any>[];
}): string {
  const { app, app_name, current_version, next_version, changes } = options;

  let notes = `## Release ${app_name} ${next_version}\n\n`;
  notes += `**Version bump:** ${current_version} → ${next_version}\n\n`;

  if (changes.length === 0) {
    notes += "No changes in this release.\n";
    return notes;
  }

  // Use formatter to generate release notes
  const formatter = app.versioning.formatter;
  const release_note_lines = formatter.generate_release_notes({
    from_version: current_version,
    to_version: next_version,
    changes,
  });

  notes += release_note_lines.join("\n");
  notes += "\n";

  return notes;
}

/**
 * Generate release body for GitHub/GitLab releases
 */
export function generate_release_body(options: {
  app: AppDefinition;
  app_name: string;
  current_version: string;
  next_version: string;
  date: Date;
  changes: Change<any>[];
}): string {
  // Use the changelog section format for releases
  return generate_changelog_section(options);
}
