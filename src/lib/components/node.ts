import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
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
      get_current_version: (file_content) => {
        const package_json = JSON.parse(file_content);
        return package_json.version;
      },
      update_version: (file_content, version) => {
        const package_json = JSON.parse(file_content);
        package_json.version = version;
        return JSON.stringify(package_json, null, 2) + "\n";
      },
    });

    return {
      root: base_path,
      parts,
      issues: warnings,
    };
  };
}
