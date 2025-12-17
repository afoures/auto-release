import type { Logger } from "../types.js";

/**
 * Simple console logger implementation
 */
export function create_logger(silent: boolean = false): Logger {
  return {
    info(message: string) {
      if (!silent) console.log(message);
    },
    warn(message: string) {
      if (!silent) console.warn(`⚠️  ${message}`);
    },
    error(message: string) {
      if (!silent) console.error(`❌ ${message}`);
    },
    success(message: string) {
      if (!silent) console.log(`✅ ${message}`);
    },
  };
}
