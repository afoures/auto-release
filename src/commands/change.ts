import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { AutoReleaseConfig } from '../types.js'
import { prompt, select, multiline } from '../utils/prompts.js'
import { create_logger } from '../utils/logger.js'

export interface ChangeOptions {
  config: AutoReleaseConfig
  cwd?: string
  app?: string
  type?: string
  summary?: string
  description?: string
}

/**
 * Create a new change file
 */
export async function change(options: ChangeOptions): Promise<string> {
  const { config, cwd = process.cwd() } = options
  const logger = create_logger()

  // Determine app
  let app_name = options.app
  if (!app_name) {
    app_name = await select(
      'Select app:',
      config.apps.map((a) => a.name)
    )
  }

  const app = config.apps.find((a) => a.name === app_name)
  if (!app) {
    throw new Error(`App "${app_name}" not found in config`)
  }

  // Get valid change types from the versioning strategy
  const valid_types = Array.from(app.versioning.change_types)

  // Determine change type
  let change_type = options.type
  if (!change_type) {
    change_type = await select('Select change type:', valid_types)
  }

  if (!valid_types.includes(change_type)) {
    throw new Error(
      `Invalid change type "${change_type}". Valid types for ${app_name}: ${valid_types.join(', ')}`
    )
  }

  // Get summary
  let summary = options.summary
  if (!summary) {
    summary = await prompt('Enter summary: ')
  }

  if (!summary.trim()) {
    throw new Error('Summary cannot be empty')
  }

  // Get description (optional)
  let description = options.description
  if (!description && !options.summary) {
    // Only prompt if not provided via CLI
    const has_description = await prompt('Add description? (y/N): ')
    if (has_description.toLowerCase() === 'y') {
      description = await multiline('Enter description:')
    }
  }

  // Generate slug from summary and timestamp
  const timestamp = new Date().toISOString().split('T')[0]
  const slug = summary
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
  const full_slug = `${timestamp}-${slug}`

  // Generate filename
  const filename = `${change_type}.${full_slug}.md`

  // Generate content
  let content: string
  if (description?.trim()) {
    content = `# ${summary}\n\n${description}\n`
  } else {
    content = `${summary}\n`
  }

  // Write file
  const changes_dir = join(cwd, config.changes_dir!, app_name)
  await mkdir(changes_dir, { recursive: true })

  const file_path = join(changes_dir, filename)
  await writeFile(file_path, content, 'utf-8')

  logger.success(`Created change file: ${file_path}`)

  return file_path
}
