import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { AppConfig, ResolvedChange, VersionStrategy } from './types.js'

/**
 * Get changelog path for an app
 */
export function get_changelog_path(
  app: AppConfig,
  cwd: string = process.cwd()
): string {
  return resolve(cwd, app.changelog.path)
}

/**
 * Format date as YYYY-MM-DD
 */
function format_date(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Group changes by type
 */
function group_changes_by_type(
  changes: ResolvedChange[]
): Map<string, ResolvedChange[]> {
  const grouped = new Map<string, ResolvedChange[]>()

  for (const change of changes) {
    if (!grouped.has(change.type)) {
      grouped.set(change.type, [])
    }
    grouped.get(change.type)!.push(change)
  }

  return grouped
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Format a single change entry
 */
function format_change(change: ResolvedChange): string {
  let entry = `- ${change.title}`
  if (change.body) {
    // Indent body content
    const indented_body = change.body
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')
    entry += `\n${indented_body}`
  }
  return entry
}

/**
 * Generate changelog section for a release
 */
export function generate_changelog_section(options: {
  app: AppConfig
  current_version: string
  next_version: string
  date: Date
  changes: ResolvedChange[]
  strategy: VersionStrategy
}): string {
  const { next_version, date, changes, strategy } = options
  const formatted_date = format_date(date)

  let section = `## ${next_version} – ${formatted_date}\n\n`

  // Group changes by type
  const grouped = group_changes_by_type(changes)

  // Order types according to strategy's change_types order
  const ordered_types = strategy.change_types.filter((type) => grouped.has(type))

  for (const type of ordered_types) {
    const type_changes = grouped.get(type)!
    section += `### ${capitalize(type)}\n\n`
    for (const change of type_changes) {
      section += format_change(change) + '\n'
    }
    section += '\n'
  }

  return section.trimEnd() + '\n'
}

/**
 * Write or update changelog file
 */
export async function write_changelog(options: {
  app: AppConfig
  current_version: string
  next_version: string
  date: Date
  changes: ResolvedChange[]
  strategy: VersionStrategy
  changelog_path: string
}): Promise<void> {
  const { changelog_path } = options

  // Generate new section
  const new_section = generate_changelog_section(options)

  // Read existing changelog if it exists
  let existing_content = ''
  try {
    existing_content = await readFile(changelog_path, 'utf-8')
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }

  // Prepare new content
  let new_content: string

  if (existing_content.trim() === '') {
    // New changelog file
    new_content = `# ${options.app.name}\n\n${new_section}\n`
  } else {
    // Existing changelog - insert after title or at beginning
    const lines = existing_content.split('\n')
    let insert_index = 0

    // Skip title if present (first line starting with #)
    if (lines[0]?.startsWith('#')) {
      insert_index = 1
      // Skip any blank lines after title
      while (insert_index < lines.length && lines[insert_index].trim() === '') {
        insert_index++
      }
    }

    const before = lines.slice(0, insert_index).join('\n')
    const after = lines.slice(insert_index).join('\n')

    new_content = before + (before ? '\n' : '') + new_section + '\n' + after
  }

  // Ensure directory exists
  await mkdir(dirname(changelog_path), { recursive: true })

  // Write changelog
  await writeFile(changelog_path, new_content, 'utf-8')
}
