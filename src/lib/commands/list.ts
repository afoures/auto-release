import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import { compute_current_version } from "../utils/version.ts";
import * as fs from "../utils/fs.ts";
import { relative } from "node:path";
import { group_projects, is_multi_project_group } from "../utils/group.ts";

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

    const project_groups = group_projects(config.managed_projects);
    const count = config.managed_projects.length;
    const group_count = project_groups.length;
    const warnings: string[] = [];

    logger.info(
      `found ${count} project${count > 1 ? "s" : ""} in ${group_count} group${group_count > 1 ? "s" : ""}:`,
    );
    logger.info("");

    for (const group of project_groups) {
      const is_multi = is_multi_project_group(group);
      logger.info(
        `Group: ${group.name} (${group.projects.length} project${group.projects.length > 1 ? "s" : ""})`,
      );

      for (const project of group.projects) {
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

        const indent = is_multi ? "  " : "";
        logger.info(`${indent}${project.name} (${version})`);
        for (const part of parts) {
          logger.info(`${indent}  ./${part.relative_path}${part.missing ? " ⚠️ missing" : ""}`);
        }
      }

      logger.info("");
    }

    return { status: "success" as const, warnings };
  },
});
