import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { get_json_version, update_json_version } from "../utils/json.ts";
import type { Component, Part } from "./types.ts";

export function node(path: string): Component {
  return (config_folder: string) => {
    const base_path = resolve(config_folder, path);
    const parts: Array<Part> = [];
    const warnings: Array<string> = [];

    const package_json_path = join(base_path, "package.json");
    const package_json_exists = existsSync(package_json_path);
    if (!package_json_exists) {
      warnings.push(`package.json not found at ${package_json_path}`);
    }

    parts.push({
      file: package_json_path,
      exists: package_json_exists,
      get_current_version: get_json_version,
      update_version: update_json_version,
    });

    return {
      root: base_path,
      parts,
      issues: warnings,
    };
  };
}
