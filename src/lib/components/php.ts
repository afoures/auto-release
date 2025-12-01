import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Component, FileToUpdate } from "./index.js";

export function php(path: string): Component {
  return () => {
    const files_to_update: Array<FileToUpdate> = [];

    const composer_json_path = join(path, "composer.json");
    if (!existsSync(composer_json_path)) {
      console.warn(`composer.json not found at ${composer_json_path}`);
    } else {
      files_to_update.push({
        path: composer_json_path,
        updater: async (content, version) => {
          const composer_json = JSON.parse(content);
          composer_json.version = version;
          return JSON.stringify(composer_json, null, 2) + "\n";
        },
      });
    }

    return {
      files_to_update,
    };
  };
}
