import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type { AutoReleaseConfig } from "./types.js";

/**
 * Helper function for users to define their config
 */
export function define_config(config: AutoReleaseConfig): AutoReleaseConfig {
  return config;
}

/**
 * Load and validate auto-release config from a TypeScript file
 */
export async function load_config(
  config_path: string = "auto-release.config.ts",
  cwd: string = process.cwd()
): Promise<AutoReleaseConfig> {
  const resolved_path = resolve(cwd, config_path);
  const file_url = pathToFileURL(resolved_path).href;

  let module: any;
  try {
    module = await import(file_url);
  } catch (error: any) {
    throw new Error(
      `Failed to load config from ${config_path}: ${error.message}`
    );
  }

  if (!module.default) {
    throw new Error(`Config file ${config_path} must have a default export`);
  }

  const config = module.default as AutoReleaseConfig;

  // Validate config structure
  validate_config(config);

  // Normalize config
  return normalize_config(config);
}

/**
 * Validate config structure and throw helpful errors
 */
function validate_config(config: AutoReleaseConfig): void {
  if (!config.apps || !Array.isArray(config.apps)) {
    throw new Error('Config must have an "apps" array');
  }

  if (config.apps.length === 0) {
    throw new Error("Config must have at least one app");
  }

  for (const app of config.apps) {
    if (!app.name) {
      throw new Error('Each app must have a "name"');
    }

    if (!app.packages || !Array.isArray(app.packages)) {
      throw new Error(`App "${app.name}" must have a "packages" array`);
    }

    if (app.packages.length === 0) {
      throw new Error(`App "${app.name}" must have at least one package`);
    }

    if (!app.versioning) {
      throw new Error(`App "${app.name}" must have a "versioning" config`);
    }

    if (typeof app.versioning.bump !== "function") {
      throw new Error(
        `App "${app.name}" versioning must have a "bump" function. Did you forget to call the strategy function?`
      );
    }

    if (
      !app.versioning.change_types ||
      !Array.isArray(app.versioning.change_types)
    ) {
      throw new Error(
        `App "${app.name}" versioning must have a "change_types" array`
      );
    }

    if (!app.changelog) {
      throw new Error(`App "${app.name}" must have a "changelog" config`);
    }

    if (!app.changelog.path) {
      throw new Error(`App "${app.name}" changelog must have a "path"`);
    }
  }
}

/**
 * Normalize and freeze config for internal use
 */
function normalize_config(config: AutoReleaseConfig): AutoReleaseConfig {
  const normalized: AutoReleaseConfig = {
    apps: config.apps,
    changes_dir: config.changes_dir || ".changes",
    git: config.git || { tag_template: "${appName}@${version}" },
  };

  return Object.freeze(normalized);
}
