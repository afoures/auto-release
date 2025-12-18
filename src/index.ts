/**
 * Auto-release - Changesets-inspired release management tool
 */

// Export core types
export type {
  AutoReleaseConfig,
  VersionManager,
  Change,
  GitPlatformClient,
  Formatter,
  ChangeKindDisplayMap,
} from "./lib/types.ts";

// Export config helper
export { define_config } from "./lib/config.ts";
