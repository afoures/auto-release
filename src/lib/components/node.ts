import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Component, FileToUpdate } from "./index.js";

export function node(path: string): Component {
  return () => {
    const files_to_update: Array<FileToUpdate> = [];

    const package_json_path = join(path, "package.json");
    if (!existsSync(package_json_path)) {
      console.warn(`package.json not found at ${package_json_path}`);
    } else {
      files_to_update.push({
        path: package_json_path,
        updater: async (content, version) => {
          const package_json = JSON.parse(content);
          package_json.version = version;
          return JSON.stringify(package_json, null, 2) + "\n";
        },
      });
    }

    return {
      files_to_update,
    };
  };
}
