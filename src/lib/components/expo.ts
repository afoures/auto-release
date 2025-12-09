import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Component, Part } from "./types.js";

export function expo(path: string): Component {
  return (root_dir: string) => {
    const base_path = resolve(root_dir, path);
    const parts: Array<Part> = [];

    const package_json_path = join(base_path, "package.json");
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

    const app_json_path = join(base_path, "app.json");
    if (existsSync(app_json_path)) {
      parts.push({
        path: app_json_path,
        get_current_version: () => {
          const content = readFileSync(app_json_path, "utf-8");
          const app_json = JSON.parse(content);
          return app_json.version;
        },
        update_version: (version: string) => {
          const content = readFileSync(app_json_path, "utf-8");
          const app_json = JSON.parse(content);
          app_json.version = version;
          writeFileSync(
            app_json_path,
            JSON.stringify(app_json, null, 2) + "\n",
            "utf-8"
          );
        },
      });
    }

    return {
      path: base_path,
      parts,
    };
  };
}
