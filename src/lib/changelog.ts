import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AppDefinition, Change } from "./types.js";

/**
 * Get changelog path for an app
 */
export function get_changelog_path(
  app: AppDefinition,
  app_name: string,
  cwd: string = process.cwd()
): string {
  return resolve(cwd, app.changelog);
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
 * Generate changelog section for a release
 */
export function generate_changelog_section(options: {
  app: AppDefinition;
  app_name: string;
  current_version: string;
  next_version: string;
  date: Date;
  changes: Change<any>[];
}): string {
  const { app, next_version, date, changes } = options;
  const formatter = app.versioning.formatter;

  // Use formatter to generate release notes
  const release_notes = formatter.generate_release_notes({
    from_version: options.current_version,
    to_version: next_version,
    changes,
  });

  const formatted_date = format_date(date);
  let section = `## ${next_version} (${formatted_date})\n\n`;
  section += release_notes.join("\n");
  section += "\n";

  return section;
}

/**
 * Generate full updated changelog content without writing to disk
 * Used by generate-release to create file content for provider commit
 */
export function generate_updated_changelog(options: {
  existing_content: string | null;
  app: AppDefinition;
  app_name: string;
  current_version: string;
  next_version: string;
  date: Date;
  changes: Change<any>[];
}): string {
  const { existing_content, app_name } = options;

  // Generate new section
  const new_section = generate_changelog_section(options);

  // Prepare new content
  let new_content: string;

  if (!existing_content || existing_content.trim() === "") {
    // New changelog file
    new_content = `# ${app_name}\n\n${new_section}\n`;
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
  app: AppDefinition;
  app_name: string;
  current_version: string;
  next_version: string;
  date: Date;
  changes: Change<any>[];
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
