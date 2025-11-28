import { get_current_version } from '../packages.js'
import { discover_all_changes } from '../changes.js'
import { create_logger } from '../utils/logger.js'
import { create_command } from '../cli.js'

export const preview = create_command({
  name: 'preview',
  description: 'Preview what would be released',
  schema: {
    app: {
      type: 'string',
      description: 'Filter by app name',
    },
    config: {
      type: 'string',
      description: 'Path to config file',
    },
  },
  run: async ({ values, config }) => {
    const cwd = process.cwd()
    const app_filter = values.app
    const logger = create_logger()

    // Discover all changes
    const changes_map = await discover_all_changes(config.apps, config.changes_dir!)

    // Filter apps if specified
    const target_apps = app_filter
      ? config.apps.filter((a) => a.name === app_filter)
      : config.apps

    if (app_filter && target_apps.length === 0) {
      throw new Error(`App "${app_filter}" not found in config`)
    }

    const results: Array<{
      app_name: string
      current_version: string
      next_version: string
      changes: typeof changes_map extends Map<string, infer C> ? C : never
    }> = []

    for (const app of target_apps) {
      const changes = changes_map.get(app.name) || []

      if (changes.length === 0) {
        continue
      }

      const current_version = await get_current_version(app, cwd)
      const strategy = app.versioning

      const next_version = strategy.bump({
        current_version,
        changes,
        time: { now: () => new Date() },
      })

      results.push({
        app_name: app.name,
        current_version,
        next_version,
        changes,
      })
    }

    // Display preview
    if (results.length === 0) {
      logger.info('No pending changes to release')
    } else {
      logger.info('Preview of next release:\n')

      for (const result of results) {
        logger.info(`📦 ${result.app_name}`)
        logger.info(`  ${result.current_version} → ${result.next_version}\n`)

        for (const change of result.changes) {
          logger.info(`  [${change.type}] ${change.title}`)
          logger.info(`    ${change.file_path}\n`)
        }
      }
    }

    return { ok: true as const }
  },
})
