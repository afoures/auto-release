import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AppConfig, Change, VersionManager } from "./types.js";

/**
 * Get changelog path for an app
 */
export function get_changelog_path(
  app: AppConfig<any>,
  cwd: string = process.cwd()
): string {
  return resolve(cwd, app.changelog.path);
}

/**
 * Format date as YYYY-MM-DD
 */
function format_date(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Default changelog formatter
 */
export const default_changelog_formatter: ChangelogFormatter = {
  template: ({ app_name }) => {
    return [
      `# \`${app_name}\` CHANGELOG`,
      "",
      "All notable changes to this project will be documented in this file.",
      "",
    ];
  },
  release: ({ version, date, changes }) => {
    const formatted_date = format_date(date);
    const lines: string[] = [`## ${version} (${formatted_date})`, ""];

    for (const change of changes) {
      lines.push(`- ${change.title}`);
      if (change.body) {
        lines.push("");
        lines.push(change.body);
      }
      lines.push("");
    }

    return lines;
  },
};

/**
 * Get the formatter for an app, falling back to default
 */
function get_formatter(app: AppConfig<any>): ChangelogFormatter {
  return app.changelog.formatter || default_changelog_formatter;
}

/**
 * Group changes by type
 */
function group_changes_by_type(
  changes: Change<any>[]
): Map<string, Change<any>[]> {
  const grouped = new Map<string, Change<any>[]>();

  for (const change of changes) {
    if (!grouped.has(change.kind)) {
      grouped.set(change.kind, []);
    }
    grouped.get(change.kind)!.push(change);
  }

  return grouped;
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a single change entry
 */
function format_change(change: Change<any>): string {
  let entry = `- ${change.title}`;
  if (change.description.length > 0) {
    // Indent body content
    const indented_description = change.description
      .map((line) => `  ${line}`)
      .join("\n");
    entry += `\n${indented_description}`;
  }
  return entry;
}

/**
 * Generate changelog section for a release
 */
export function generate_changelog_section(options: {
  app: AppConfig<any>;
  current_version: string;
  next_version: string;
  date: Date;
  changes: Change<any>[];
  versioning: VersionManager<any>;
}): string {
  const { app, next_version, date, changes } = options;
  const formatter = get_formatter(app);

  // Use formatter if available
  if (formatter.release) {
    const lines = formatter.release({
      version: next_version,
      date,
      changes,
    });
    return lines.join("\n") + "\n";
  }

  // Fallback to old format if no formatter
  const formatted_date = format_date(date);
  let section = `## ${next_version} – ${formatted_date}\n\n`;

  // Group changes by type
  const grouped = group_changes_by_type(changes);

  // Order types according to strategy's change_types order
  const ordered_types = options.versioning.allowed_changes.filter((kind) =>
    grouped.has(kind)
  );

  for (const type of ordered_types) {
    const type_changes = grouped.get(type)!;
    section += `### ${capitalize(type)}\n\n`;
    for (const change of type_changes) {
      section += format_change(change) + "\n";
    }
    section += "\n";
  }

  return section.trimEnd() + "\n";
}

/**
 * Generate full updated changelog content without writing to disk
 * Used by generate-release to create file content for provider commit
 */
export function generate_updated_changelog(options: {
  existing_content: string | null;
  app: AppConfig<any>;
  current_version: string;
  next_version: string;
  date: Date;
  changes: Change<any>[];
  versioning: VersionManager<any>;
}): string {
  const { existing_content, app } = options;
  const formatter = get_formatter(app);

  // Generate new section
  const new_section = generate_changelog_section(options);

  // Prepare new content
  let new_content: string;

  if (!existing_content || existing_content.trim() === "") {
    // New changelog file - use template formatter if available
    if (formatter.template) {
      const template_lines = formatter.template({ app_name: app.name });
      new_content = template_lines.join("\n") + "\n\n" + new_section;
    } else {
      new_content = `# ${app.name}\n\n${new_section}\n`;
    }
  } else {
    // Existing changelog - insert after title or at beginning
    const lines = existing_content.split("\n");
    let insert_index = 0;

    // Skip title if present (first line starting with #)
    if (lines[0]?.startsWith("#")) {
      insert_index = 1;
      // Skip any blank lines after title
      while (insert_index < lines.length && lines[insert_index].trim() === "") {
        insert_index++;
      }
    }

    const before = lines.slice(0, insert_index).join("\n");
    const after = lines.slice(insert_index).join("\n");

    new_content = before + (before ? "\n" : "") + new_section + "\n" + after;
  }

  return new_content;
}

/**
 * Write or update changelog file
 */
export async function write_changelog(options: {
  app: AppConfig<any>;
  current_version: string;
  next_version: string;
  date: Date;
  changes: Change<any>[];
  versioning: VersionManager<any>;
  changelog_path: string;
}): Promise<void> {
  const { changelog_path } = options;

  // Read existing changelog if it exists
  let existing_content: string | null = null;
  try {
    existing_content = await readFile(changelog_path, "utf-8");
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  // Generate updated content
  const new_content = generate_updated_changelog({
    ...options,
    existing_content,
  });

  // Ensure directory exists
  await mkdir(dirname(changelog_path), { recursive: true });

  // Write changelog
  await writeFile(changelog_path, new_content, "utf-8");
}
