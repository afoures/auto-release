import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { dirname, isAbsolute, resolve } from "node:path";
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
  #root_dir: string | undefined;

  constructor(config: AutoReleaseConfig) {
    this.#config = config;
    this.#root_dir = undefined;
  }

  set_root_dir(root_dir: string): void {
    this.#root_dir = root_dir;
  }

  get changes_dir(): string {
    const configured_changes_dir = this.#config.changes_dir || ".changes";
    const root_dir = this.#root_dir;
    if (!root_dir) {
      throw new Error(
        "Cannot get changes directory: auto-release root directory not set"
      );
    }
    return isAbsolute(configured_changes_dir)
      ? configured_changes_dir
      : resolve(root_dir, configured_changes_dir);
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
    const root_dir = this.#root_dir;
    if (!root_dir) {
      throw new Error(
        "Cannot get managed applications: auto-release root directory not set"
      );
    }
    return Object.entries(this.#config.apps).map(([name, definition]) => ({
      name,
      ...definition,
      components: definition.components.map((component) => component(root_dir)),
    }));
  }
}

/**
 * Load and validate auto-release config from a TypeScript file
 */
async function load_config(
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

  config.set_root_dir(dirname(resolved_path));

  return config;
}

const CONFIG_CANDIDATES = [
  "auto-release.config.ts",
  "auto-release.config.mts",
  "auto-release.config.cts",
  "auto-release.config.js",
  "auto-release.config.mjs",
  "auto-release.config.cjs",
] as const;

async function path_exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function find_git_root(start_dir: string): Promise<string | undefined> {
  let current_dir = start_dir;
  while (true) {
    const git_dir = resolve(current_dir, ".git");
    if (await path_exists(git_dir)) {
      return current_dir;
    }
    const parent_dir = dirname(current_dir);
    if (parent_dir === current_dir) {
      return undefined;
    }
    current_dir = parent_dir;
  }
}

async function find_config_candidate(
  start_dir: string,
  stop_dir?: string
): Promise<string | undefined> {
  let current_dir = start_dir;
  while (true) {
    for (const candidate of CONFIG_CANDIDATES) {
      const candidate_path = resolve(current_dir, candidate);
      if (await path_exists(candidate_path)) {
        return candidate_path;
      }
    }

    if (stop_dir && current_dir === stop_dir) {
      return undefined;
    }

    const parent_dir = dirname(current_dir);
    if (parent_dir === current_dir) {
      return undefined;
    }
    current_dir = parent_dir;
  }
}

interface ResolvedConfigPath {
  config_path: string;
  root_dir: string;
}

async function resolve_config_path(options?: {
  config_path?: string;
  cwd?: string;
}): Promise<ResolvedConfigPath> {
  const cwd = options?.cwd ? resolve(options.cwd) : process.cwd();
  const explicit_path = options?.config_path;

  if (explicit_path) {
    const resolved_explicit = resolve(cwd, explicit_path);
    const exists = await path_exists(resolved_explicit);
    if (!exists) {
      throw new Error(`Config file not found at ${resolved_explicit}`);
    }
    return {
      config_path: resolved_explicit,
      root_dir: dirname(resolved_explicit),
    };
  }

  const git_root = await find_git_root(cwd);
  const config_candidate = await find_config_candidate(cwd, git_root);

  if (!config_candidate) {
    const stop_point = git_root || "filesystem root";
    throw new Error(
      `Could not find config (searched for ${CONFIG_CANDIDATES.join(
        ", "
      )}) from ${cwd} up to ${stop_point}`
    );
  }

  return {
    config_path: config_candidate,
    root_dir: dirname(config_candidate),
  };
}

export async function find_nearest_config(options?: {
  config_path?: string;
  cwd?: string;
}): Promise<{ config: InternalConfig; root_dir: string }> {
  const { config_path, root_dir } = await resolve_config_path(options);
  const config = await load_config(config_path, root_dir);
  return { config, root_dir };
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
