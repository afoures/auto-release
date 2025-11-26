import type { AutoReleaseConfig, DeployContext } from '../types.js'
import { get_current_version, resolve_packages } from '../packages.js'
import { create_logger } from '../utils/logger.js'
import { exec as util_exec } from '../utils/exec.js'
import { confirm } from '../utils/prompts.js'

export interface DeployOptions {
  config: AutoReleaseConfig
  cwd?: string
  app?: string
  dry_run?: boolean
  yes?: boolean
}

/**
 * Deploy apps and create git tags
 */
export async function deploy(options: DeployOptions): Promise<void> {
  const {
    config,
    cwd = process.cwd(),
    app: app_filter,
    dry_run = false,
    yes = false,
  } = options
  const logger = create_logger()

  // Filter apps if specified
  const target_apps = app_filter
    ? config.apps.filter((a) => a.name === app_filter)
    : config.apps

  if (app_filter && target_apps.length === 0) {
    throw new Error(`App "${app_filter}" not found in config`)
  }

  // Prepare deployment contexts
  const deployments: Array<{
    app: typeof target_apps[0]
    context: DeployContext
    version: string
  }> = []

  for (const app of target_apps) {
    const current_version = await get_current_version(app, cwd)
    const packages = await resolve_packages(app, cwd)

    const context: DeployContext = {
      app,
      current_version,
      packages,
      dry_run,
      logger,
      exec: (command: string) => util_exec(command, { cwd }),
    }

    deployments.push({ app, context, version: current_version })
  }

  // Display plan
  logger.info('Deployment plan:\n')
  for (const dep of deployments) {
    logger.info(`📦 ${dep.app.name}@${dep.version}`)
    if (dep.app.deploy?.command) {
      logger.info(`  Command: ${dep.app.deploy.command}`)
    }
    if (dep.app.deploy?.handler) {
      logger.info(`  Handler: custom function`)
    }
    logger.info(`  Tag: ${format_tag(config, dep.app.name, dep.version)}\n`)
  }

  if (dry_run) {
    logger.info('Dry run - no changes will be made')
    return
  }

  // Confirm
  if (!yes) {
    const confirmed = await confirm('Proceed with deployment?', false)
    if (!confirmed) {
      logger.info('Deployment cancelled')
      return
    }
  }

  // Execute deployments
  const successful_deployments: typeof deployments = []
  let failed = false

  for (const dep of deployments) {
    logger.info(`\nDeploying ${dep.app.name}...`)

    try {
      // Run command if configured
      if (dep.app.deploy?.command) {
        logger.info(`Running: ${dep.app.deploy.command}`)
        const result = await util_exec(dep.app.deploy.command, { cwd })
        if (result.stdout) {
          logger.info(result.stdout)
        }
      }

      // Run handler if configured
      if (dep.app.deploy?.handler) {
        logger.info('Running deploy handler...')
        await dep.app.deploy.handler(dep.context)
      }

      logger.success(`Deployed ${dep.app.name}@${dep.version}`)
      successful_deployments.push(dep)
    } catch (error: any) {
      logger.error(`Failed to deploy ${dep.app.name}: ${error.message}`)
      failed = true
      break
    }
  }

  // If any deployment failed, don't create tags
  if (failed) {
    logger.error('\n❌ Deployment failed - no tags created')
    process.exit(1)
  }

  // Create git tags for successful deployments
  logger.info('\nCreating git tags...')
  for (const dep of successful_deployments) {
    const tag = format_tag(config, dep.app.name, dep.version)
    try {
      await util_exec(`git tag ${tag}`, { cwd })
      logger.success(`Created tag: ${tag}`)
    } catch (error: any) {
      logger.error(`Failed to create tag ${tag}: ${error.message}`)
    }
  }

  logger.success('\n✨ Deployment complete!')
  logger.info('Push tags with: git push --tags')
}

/**
 * Format git tag using template
 */
function format_tag(
  config: AutoReleaseConfig,
  app_name: string,
  version: string
): string {
  const template = config.git?.tag_template || '${appName}@${version}'
  return template.replace('${appName}', app_name).replace('${version}', version)
}
