import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import { compute_current_version } from "../utils/version.ts";
import * as fs from "../utils/fs.ts";
import { relative } from "node:path";

export const list = create_command({
  name: "list",
  description: "List all registered projects with their current version and registered components",
  schema: {
    config: {
      type: "string",
      description: "Path to config file",
      short: "c",
    },
  },
  get_context: async ({ args, cwd }) => {
    const { config, git_root } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config, root: git_root || config.folder };
  },
  run: async ({ context: { config, root } }) => {
    const logger = create_logger();

    if (config.managed_projects.length === 0) {
      logger.info("no projects registered.");
      return { status: "success" as const };
    }

    const count = config.managed_projects.length;
    const warnings: string[] = [];

    logger.info(`found ${count} project${count > 1 ? "s" : ""}:`);
    logger.info("");

    for (const project of config.managed_projects) {
      const version = await compute_current_version(project, {
        get_file_content: (file_path: string) => fs.read_file(file_path),
      });
      if (version === null) {
        warnings.push(`${project.name} has no version`);
        continue;
      }

      const parts = project.components.flatMap((component) =>
        component.parts.map((part) => ({
          relative_path: relative(root, part.file),
          missing: part.exists === false,
        })),
      );

      logger.note(
        `${project.name} (${version})`,
        parts
          .map((part) => `./${part.relative_path} ${part.missing ? "⚠️ missing" : ""}`)
          .join("\n"),
      );
      logger.info("");
    }

    return { status: "success" as const, warnings };
  },
});
