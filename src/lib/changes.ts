import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ResolvedChange, AppConfig } from './types.js'

const CHANGE_FILE_REGEX = /^([a-z0-9-]+)\.([a-z0-9-]+)\.md$/

/**
 * Parse change filename and validate format
 * Expected format: type.slug-words.md
 */
export function parse_change_filename(
  filename: string
): { type: string; slug: string } | null {
  const match = filename.match(CHANGE_FILE_REGEX)
  if (!match) {
    return null
  }
  return { type: match[1], slug: match[2] }
}

/**
 * Parse markdown content to extract title and body
 * If first non-empty line starts with #, treat as heading title with remaining as body
 * Otherwise, treat first line as simple title
 */
export function parse_change_markdown(content: string): {
  title: string
  body?: string
} {
  const lines = content.split('\n')
  const non_empty_lines = lines.filter((line) => line.trim() !== '')

  if (non_empty_lines.length === 0) {
    throw new Error('Change file is empty')
  }

  const first_line = non_empty_lines[0].trim()

  // Check if first line is a heading
  if (first_line.startsWith('#')) {
    const title = first_line.replace(/^#+\s*/, '').trim()
    const body_start_index = lines.findIndex((line) => line.trim() === first_line)
    const body_lines = lines.slice(body_start_index + 1).join('\n').trim()
    return {
      title,
      body: body_lines || undefined,
    }
  }

  // Simple title (first line)
  return {
    title: first_line,
    body: non_empty_lines.slice(1).join('\n').trim() || undefined,
  }
}

/**
 * Discover and parse change files for a specific app
 */
export async function discover_changes(
  app_name: string,
  changes_dir: string,
  valid_change_types: readonly string[]
): Promise<ResolvedChange[]> {
  const app_changes_dir = join(changes_dir, app_name)
  
  let files: string[]
  try {
    files = await readdir(app_changes_dir)
  } catch (error: any) {
    // Directory doesn't exist or can't be read - no changes
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  }

  const changes: ResolvedChange[] = []

  for (const file of files) {
    if (!file.endsWith('.md')) {
      continue
    }

    const parsed = parse_change_filename(file)
    if (!parsed) {
      throw new Error(
        `Invalid change filename format: ${file} (expected: type.slug-words.md)`
      )
    }

    if (!valid_change_types.includes(parsed.type)) {
      throw new Error(
        `Invalid change type "${parsed.type}" in file ${file}. Valid types: ${valid_change_types.join(', ')}`
      )
    }

    const file_path = join(app_changes_dir, file)
    const content = await readFile(file_path, 'utf-8')
    const { title, body } = parse_change_markdown(content)

    changes.push({
      app_name,
      type: parsed.type,
      title,
      body,
      file_path,
    })
  }

  return changes
}

/**
 * Discover changes for all apps
 */
export async function discover_all_changes(
  apps: AppConfig[],
  changes_dir: string
): Promise<Map<string, ResolvedChange[]>> {
  const changes_map = new Map<string, ResolvedChange[]>()

  for (const app of apps) {
    const valid_change_types = app.versioning.change_types

    const changes = await discover_changes(
      app.name,
      changes_dir,
      valid_change_types
    )
    changes_map.set(app.name, changes)
  }

  return changes_map
}
