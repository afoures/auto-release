import { create_logger } from "../utils/logger.js";
import { create_command } from "../cli.js";
import { find_nearest_config } from "../config.js";

export const list = create_command({
  name: "list",
  description: "List all registered apps with their current version and registered components",
  schema: {
    config: {
      type: "string",
      description: "Path to config file",
    },
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  get_context: async ({ args, cwd }) => {
    const { config } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config };
  },
  run: async ({ args, context }) => {
    const json = args.json ?? false;
    const logger = create_logger(json);

    const config = context.config;
    const apps_data = config.managed_applications.map((app) => {
      const part_paths = app.components.flatMap((component) =>
        component.parts.map((part) => part.path),
      );
      let version: string;
      try {
        version = app.current_version;
      } catch (error: any) {
        version = `Error: ${error.message}`;
      }
      return {
        name: app.name,
        version,
        parts: part_paths,
      };
    });

    if (json) {
      console.log(JSON.stringify(apps_data, null, 2));
    } else {
      if (apps_data.length === 0) {
        logger.info("No apps registered.");
        return { status: "success" as const };
      }

      logger.info(`Found ${apps_data.length} registered app${apps_data.length > 1 ? "s" : ""}:\n`);

      for (const app of apps_data) {
        logger.info(`App: ${app.name}`);
        logger.info(`  Current version: ${app.version}`);
        logger.info(`  Managed files:`);
        if (app.parts.length === 0) {
          logger.info(`    (none)`);
        } else {
          for (const part_path of app.parts) {
            logger.info(`    - ${part_path}`);
          }
        }
        logger.info("");
      }
    }

    return { status: "success" as const };
  },
});
