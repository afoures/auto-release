import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Change, AppConfig } from "./types.js";
import { regex } from "arkregex";

const CHANGE_FILE_REGEX = regex(
  "^(?<kind>[a-z0-9-]+)\\.(?<slug>[a-z0-9-]+)\\.md$"
);

/**
 * Parse change filename and validate format
 * Expected format: type.slug-words.md
 */
export function parse_change_filename(
  filename: string
): { kind: string; slug: string } | null {
  const match = CHANGE_FILE_REGEX.exec(filename);
  if (!match) {
    return null;
  }
  return { kind: match.groups.kind, slug: match.groups.slug };
}

/**
 * Parse markdown content to extract title and body
 * If first non-empty line starts with #, treat as heading title with remaining as body
 * Otherwise, treat first line as simple title
 */
export function parse_change_markdown(content: string) {
  const lines = content.split("\n");
  const non_empty_lines = lines.filter((line) => line.trim() !== "");

  if (non_empty_lines.length === 0) {
    throw new Error("Change file is empty");
  }

  const first_line = non_empty_lines[0].trim();

  // Check if first line is a heading
  if (first_line.startsWith("#")) {
    const title = first_line.replace(/^#+\s*/, "").trim();
    const body_start_index = lines.findIndex(
      (line) => line.trim() === first_line
    );
    const body_lines = lines.slice(body_start_index + 1);
    return {
      title,
      description: body_lines,
    };
  }

  // Simple title (first line)
  return {
    title: first_line,
    description: non_empty_lines.slice(1),
  };
}

/**
 * Discover and parse change files for a specific app
 */
export async function discover_changes<change_kind extends string>(
  app_name: string,
  changes_dir: string,
  valid_change_kinds: readonly change_kind[]
): Promise<Change<change_kind>[]> {
  const app_changes_dir = join(changes_dir, app_name);

  let files: string[];
  try {
    files = await readdir(app_changes_dir);
  } catch (error: any) {
    // Directory doesn't exist or can't be read - no changes
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const changes: Change<change_kind>[] = [];

  for (const file of files) {
    if (!file.endsWith(".md")) {
      continue;
    }

    const parsed = parse_change_filename(file);
    if (!parsed) {
      throw new Error(
        `Invalid change filename format: ${file} (expected: type.slug-words.md)`
      );
    }

    if (!valid_change_kinds.includes(parsed.kind as change_kind)) {
      throw new Error(
        `Invalid change kind "${
          parsed.kind
        }" in file ${file}. Valid kinds: ${valid_change_kinds.join(", ")}`
      );
    }

    const file_path = join(app_changes_dir, file);
    const content = await readFile(file_path, "utf-8");
    const { title, description } = parse_change_markdown(content);

    changes.push({
      kind: parsed.kind as change_kind,
      title,
      description,
    });
  }

  return changes;
}

/**
 * Change with metadata (file path and app name)
 */
export interface ChangeWithMetadata<change_kind extends string>
  extends Change<change_kind> {
  file_path: string;
  app_name: string;
}

/**
 * Discover changes for all apps (record-based)
 */
export async function discover_all_changes(
  apps: Record<string, AppConfig<any>>,
  changes_dir: string
): Promise<Map<string, Change<any>[]>> {
  const changes_map = new Map<string, Change<any>[]>();

  for (const [app_name, app] of Object.entries(apps)) {
    const valid_change_types = app.versioning.allowed_changes;

    const changes = await discover_changes(
      app_name,
      changes_dir,
      valid_change_types
    );
    changes_map.set(app_name, changes);
  }

  return changes_map;
}

/**
 * Discover changes with metadata for all apps
 */
export async function discover_all_changes_with_metadata(
  apps: Record<string, AppConfig<any>>,
  changes_dir: string
): Promise<Map<string, ChangeWithMetadata<any>[]>> {
  const changes_map = new Map<string, ChangeWithMetadata<any>[]>();

  for (const [app_name, app] of Object.entries(apps)) {
    const valid_change_types = app.versioning.allowed_changes;
    const app_changes_dir = join(changes_dir, app_name);

    let files: string[];
    try {
      files = await readdir(app_changes_dir);
    } catch (error: any) {
      // Directory doesn't exist or can't be read - no changes
      if (error.code === "ENOENT") {
        changes_map.set(app_name, []);
        continue;
      }
      throw error;
    }

    const changes: ChangeWithMetadata<any>[] = [];

    for (const file of files) {
      if (!file.endsWith(".md")) {
        continue;
      }

      const parsed = parse_change_filename(file);
      if (!parsed) {
        throw new Error(
          `Invalid change filename format: ${file} (expected: type.slug-words.md)`
        );
      }

      if (!valid_change_types.includes(parsed.kind)) {
        throw new Error(
          `Invalid change kind "${
            parsed.kind
          }" in file ${file}. Valid kinds: ${valid_change_types.join(", ")}`
        );
      }

      const file_path = join(app_changes_dir, file);
      const content = await readFile(file_path, "utf-8");
      const { title, description } = parse_change_markdown(content);

      changes.push({
        kind: parsed.kind,
        title,
        description,
        file_path,
        app_name,
      });
    }

    changes_map.set(app_name, changes);
  }

  return changes_map;
}
