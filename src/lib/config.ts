import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type {
  AutoReleaseConfig,
  GitProvider,
  ManagedApplication,
} from "./types.js";

export function define_config<const config extends AutoReleaseConfig>(
  config: config
): InternalConfig {
  validate_config(config);
  return new InternalConfig(config);
}

export class InternalConfig {
  #config: AutoReleaseConfig;
  constructor(config: AutoReleaseConfig) {
    this.#config = config;
  }

  get changes_dir(): string {
    return this.#config.changes_dir || ".changes";
  }

  get git(): {
    provider: GitProvider;
    default_target_branch: string;
    default_release_branch_prefix: string;
  } {
    return {
      provider: this.#config.git.provider,
      default_target_branch: this.#config.git.default_target_branch || "main",
      default_release_branch_prefix:
        this.#config.git.default_release_branch_prefix || "release",
    };
  }

  get managed_applications(): Array<ManagedApplication> {
    return Object.entries(this.#config.apps).map(([name, definition]) => ({
      name,
      ...definition,
    }));
  }
}

/**
 * Load and validate auto-release config from a TypeScript file
 */
export async function load_config(
  config_path: string = "auto-release.config.ts",
  cwd: string = process.cwd()
): Promise<InternalConfig> {
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
    throw new Error(
      `Auto-release config file ${config_path} must have a default export`
    );
  }

  const config = module.default;

  if (!(config instanceof InternalConfig)) {
    throw new Error("Auto-release config is invalid");
  }

  return config;
}

/**
 * Validate config structure and throw helpful errors
 */
function validate_config(config: AutoReleaseConfig): void {
  if (!config.git) {
    throw new Error(
      'Auto-release config must have a "git" provider. Use github() or gitlab() from "auto-release/providers"'
    );
  }

  if (
    !config.apps ||
    typeof config.apps !== "object" ||
    Array.isArray(config.apps)
  ) {
    throw new Error(
      'Auto-release config must have an "apps" record (object keyed by app name)'
    );
  }

  const app_entries = Object.entries(config.apps);
  if (app_entries.length === 0) {
    throw new Error("Auto-release config must have at least one app");
  }

  for (const [name, app] of app_entries) {
    if (!app.components || !Array.isArray(app.components)) {
      throw new Error(`App "${name}" must have a "components" array`);
    }

    if (app.components.length === 0) {
      throw new Error(`App "${name}" must have at least one component`);
    }

    if (!app.versioning) {
      throw new Error(`App "${name}" must have a "versioning" config`);
    }

    if (typeof app.versioning.bump !== "function") {
      throw new Error(
        `App "${name}" versioning must have a "bump" function. Did you forget to call the strategy function?`
      );
    }

    if (
      !app.versioning.allowed_changes ||
      !Array.isArray(app.versioning.allowed_changes)
    ) {
      throw new Error(
        `App "${name}" versioning must have an "allowed_changes" array`
      );
    }

    if (!app.changelog || typeof app.changelog !== "string") {
      throw new Error(`App "${name}" must have a changelog path (string)`);
    }
  }
}
