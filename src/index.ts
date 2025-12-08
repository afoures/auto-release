/**
 * Auto-release - Changesets-inspired release management tool
 */

// Export core types
export type {
  AutoReleaseConfig,
  VersionManager,
  Change,
  GitProvider,
  Formatter,
  ChangeKindDisplayMap,
} from "./lib/types.js";

// Export config helper
export { define_config } from "./lib/config.js";
