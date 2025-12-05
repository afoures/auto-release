import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Component, Part } from "./types.js";

export function node(path: string): Component {
  return () => {
    const parts: Array<Part> = [];

    const package_json_path = join(path, "package.json");
    if (!existsSync(package_json_path)) {
      console.warn(`package.json not found at ${package_json_path}`);
    } else {
      parts.push({
        path: package_json_path,
        get_current_version: () => {
          const content = readFileSync(package_json_path, "utf-8");
          const package_json = JSON.parse(content);
          return package_json.version;
        },
        update_version: (version: string) => {
          const content = readFileSync(package_json_path, "utf-8");
          const package_json = JSON.parse(content);
          package_json.version = version;
          writeFileSync(
            package_json_path,
            JSON.stringify(package_json, null, 2) + "\n",
            "utf-8"
          );
        },
      });
    }

    return {
      path,
      parts,
    };
  };
}
