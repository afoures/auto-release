import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import type { AutoReleaseConfig, VersionStrategy } from './types.js'
import { semver_strategy } from './strategies/semver.js'
import { calver_strategy } from './strategies/calver.js'

const BUILTIN_STRATEGIES: Record<string, VersionStrategy> = {
  semver: semver_strategy,
  calver: calver_strategy,
}

/**
 * Helper function for users to define their config
 */
export function define_config(config: AutoReleaseConfig): AutoReleaseConfig {
  return config
}

/**
 * Load and validate auto-release config from a TypeScript file
 */
export async function load_config(
  config_path: string = 'auto-release.config.ts',
  cwd: string = process.cwd()
): Promise<AutoReleaseConfig> {
  const resolved_path = resolve(cwd, config_path)
  const file_url = pathToFileURL(resolved_path).href

  let module: any
  try {
    module = await import(file_url)
  } catch (error: any) {
    throw new Error(
      `Failed to load config from ${config_path}: ${error.message}`
    )
  }

  if (!module.default) {
    throw new Error(
      `Config file ${config_path} must have a default export`
    )
  }

  const config = module.default as AutoReleaseConfig

  // Validate config structure
  validate_config(config)

  // Normalize config
  return normalize_config(config)
}

/**
 * Validate config structure and throw helpful errors
 */
function validate_config(config: AutoReleaseConfig): void {
  if (!config.apps || !Array.isArray(config.apps)) {
    throw new Error('Config must have an "apps" array')
  }

  if (config.apps.length === 0) {
    throw new Error('Config must have at least one app')
  }

  for (const app of config.apps) {
    if (!app.name) {
      throw new Error('Each app must have a "name"')
    }

    if (!app.packages || !Array.isArray(app.packages)) {
      throw new Error(`App "${app.name}" must have a "packages" array`)
    }

    if (app.packages.length === 0) {
      throw new Error(`App "${app.name}" must have at least one package`)
    }

    if (!app.versioning) {
      throw new Error(`App "${app.name}" must have a "versioning" config`)
    }

    if (!app.versioning.strategy) {
      throw new Error(`App "${app.name}" must have a "versioning.strategy"`)
    }

    if (!app.versioning.change_types || !Array.isArray(app.versioning.change_types)) {
      throw new Error(`App "${app.name}" must have "versioning.change_types" array`)
    }
  }
}

/**
 * Normalize and freeze config for internal use
 */
function normalize_config(config: AutoReleaseConfig): AutoReleaseConfig {
  const normalized: AutoReleaseConfig = {
    apps: config.apps.map((app) => ({
      ...app,
      versioning: {
        ...app.versioning,
        strategy: resolve_strategy(
          app.versioning.strategy,
          config.version_strategies
        ),
      },
    })),
    changes_dir: config.changes_dir || '.changes',
    default_changelog_dir: config.default_changelog_dir || 'changelogs',
    version_strategies: config.version_strategies,
    git: config.git || { tag_template: '${appName}@${version}' },
  }

  return Object.freeze(normalized)
}

/**
 * Resolve strategy from string ID or strategy object
 */
function resolve_strategy(
  strategy: string | VersionStrategy,
  custom_strategies?: Record<string, VersionStrategy>
): VersionStrategy {
  if (typeof strategy === 'object') {
    return strategy
  }

  // Check builtin strategies
  if (BUILTIN_STRATEGIES[strategy]) {
    return BUILTIN_STRATEGIES[strategy]
  }

  // Check custom strategies
  if (custom_strategies && custom_strategies[strategy]) {
    return custom_strategies[strategy]
  }

  throw new Error(
    `Unknown version strategy: ${strategy}. Available: ${Object.keys(
      BUILTIN_STRATEGIES
    ).join(', ')}`
  )
}
