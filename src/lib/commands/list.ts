import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import { relative } from "node:path";

export const list = create_command({
  name: "list",
  description: "List all registered apps with their current version and registered components",
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

    if (config.managed_applications.length === 0) {
      logger.info("no applications registered.");
      return { status: "success" as const };
    }

    const count = config.managed_applications.length;
    const warnings: string[] = [];

    logger.info(`found ${count} application${count > 1 ? "s" : ""}:`);
    logger.info("");

    for (const app of config.managed_applications) {
      let version: string;
      try {
        version = app.current_version;
      } catch (error: any) {
        warnings.push(`${app.name} has no version: ${error.message}`);
        version = `unknown`;
      }

      const parts = app.components.flatMap((component) =>
        component.parts.map((part) => ({
          relative_path: relative(root, part.file),
          missing: part.exists === false,
        })),
      );

      logger.note(
        `${app.name} (${version})`,
        parts
          .map((part) => `./${part.relative_path} ${part.missing ? "⚠️ missing" : ""}`)
          .join("\n"),
      );
      logger.info("");
    }

    return { status: "success" as const, warnings };
  },
});
