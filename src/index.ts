/**
 * Auto-release - Changesets-inspired release management tool
 */

// Export core types
export type {
  AutoReleaseConfig,
  AppConfig,
  DeployConfig,
  DeployContext,
  VersionStrategy,
  VersioningConfig,
  ChangelogConfig,
  GitConfig,
  ResolvedChange,
  ValidationResult,
  Logger,
} from './types.js'

// Export config helper
export { define_config } from './config.js'
