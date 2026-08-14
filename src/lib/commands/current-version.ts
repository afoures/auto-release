import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import { compute_current_version } from "../utils/version.ts";
import * as fs from "../utils/fs.ts";

export const current_version = create_command({
  name: "current-version",
  description: "Print the current version of registered projects",
  schema: {
    config: {
      type: "string",
      description: "Path to config file",
      short: "c",
    },
    project: {
      type: "string",
      description: "Only report this project, printing the bare version",
    },
    json: {
      type: "boolean",
      description: "Output JSON instead of plain text",
    },
  },
  get_context: async ({ args, cwd }) => {
    const { config, git_root } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config, root: git_root || config.folder };
  },
  run: async ({ args, context: { config } }) => {
    let projects = config.managed_projects;

    if (args.project) {
      projects = projects.filter((project) => project.name === args.project);
      if (projects.length === 0) {
        return {
          status: "error" as const,
          error: `Project "${args.project}" not found in config`,
        };
      }
    }

    if (projects.length === 0) {
      return {
        status: "error" as const,
        error: "No projects registered in config",
      };
    }

    const versions: Array<{ project: string; version: string }> = [];

    for (const project of projects) {
      const version = await compute_current_version(project, {
        get_file_content: (file_path: string) => fs.read_file(file_path),
      });
      // Reporting `initial_version` here would pass off a fabricated version as
      // the one on disk, so a project without readable files is an error.
      if (version === null) {
        return {
          status: "error" as const,
          error: `No version found for project "${project.name}" (no readable component files)`,
        };
      }

      versions.push({ project: project.name, version });
    }

    if (args.json) {
      // Always an array, even for a single project, so consumers can rely on the shape.
      console.log(JSON.stringify(versions));
    } else if (args.project) {
      console.log(versions[0].version);
    } else {
      // Same format whatever the project count, so scripts never special case repo size.
      for (const { project, version } of versions) {
        console.log(`${project} ${version}`);
      }
    }

    return { status: "success" as const, silent: true };
  },
});
