import type { AutoReleaseConfig, ValidationResult } from '../types.js'
import { validate_packages } from '../packages.js'
import { discover_all_changes } from '../changes.js'
import { create_logger } from '../utils/logger.js'

export interface ValidateOptions {
  config: AutoReleaseConfig
  cwd?: string
  json?: boolean
}

/**
 * Validate configuration, packages, and change files
 */
export async function validate(options: ValidateOptions): Promise<ValidationResult> {
  const { config, cwd = process.cwd(), json = false } = options
  const logger = create_logger(json)

  const errors: string[] = []
  const warnings: string[] = []

  // Validate packages
  logger.info('Validating packages...')
  const package_validation = await validate_packages(config.apps, cwd)
  errors.push(...package_validation.errors)

  // Validate change files
  logger.info('Validating change files...')
  try {
    await discover_all_changes(config.apps, config.changes_dir!)
  } catch (error: any) {
    errors.push(error.message)
  }

  const valid = errors.length === 0

  if (json) {
    console.log(
      JSON.stringify({ valid, errors, warnings }, null, 2)
    )
  } else {
    if (valid) {
      logger.success('All validations passed!')
    } else {
      logger.error('Validation failed:')
      errors.forEach((err) => logger.error(`  ${err}`))
    }

    if (warnings.length > 0) {
      warnings.forEach((warn) => logger.warn(`  ${warn}`))
    }
  }

  return { valid, errors, warnings }
}
