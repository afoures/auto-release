import { join } from "node:path";
import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import * as fs from "../utils/fs.ts";
import { compute_current_version } from "../utils/version.ts";
import { find_change_files } from "../change-file.ts";
import { base_version, format_prerelease } from "../versioning/prerelease.ts";

export const apply_prerelease = create_command({
  name: "apply-prerelease",
  description:
    "Apply a pre-release version (<base>-<channel>.<id>) to component files in place, for a build/publish step",
  schema: {
    config: {
      type: "string",
      description: "Path to config file",
    },
    channel: {
      type: "string",
      description: "Pre-release channel (e.g. preview, alpha, beta, rc)",
    },
    id: {
      type: "string",
      description: "Pre-release identifier, e.g. a commit sha or build number",
    },
    project: {
      type: "string",
      description: "Only apply to this project (defaults to all managed projects)",
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would be done without writing files",
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
    const logger = create_logger();

    const channel = args.channel?.trim();
    const id = args.id?.trim();
    const dry_run = args["dry-run"] ?? false;

    if (!channel) {
      return {
        status: "error" as const,
        error: "Missing required option --channel (e.g. --channel rc)",
      };
    }
    if (!id) {
      return {
        status: "error" as const,
        error: 'Missing required option --id (e.g. --id "$GITHUB_RUN_NUMBER")',
      };
    }

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
        status: "success" as const,
        message: "No projects to apply",
      };
    }

    const applied: string[] = [];

    for (const project of projects) {
      const current_version =
        (await compute_current_version(project, {
          get_file_content: (file_path: string) => fs.read_file(file_path),
        })) ?? project.versioning.initial_version;
      // Drop any existing suffix so we always pre-release from a clean base.
      const current_base = base_version(current_version);

      const changes = await find_change_files(join(config.changes_dir, project.name), {
        allowed_kinds: project.versioning.allowed_changes,
      });
      for (const warning of changes.warnings) {
        logger.warn(warning);
      }

      // On a feature branch the change files are still present, so the base is the
      // next stable version they would produce. On the release branch they have
      // already been consumed and the version is bumped, so the base is the
      // current version as-is.
      const base =
        changes.list.length > 0
          ? project.versioning.bump({
              version: current_base,
              changes: changes.list,
              date: new Date(),
            })
          : current_base;

      if (!project.versioning.validate({ version: base })) {
        return {
          status: "error" as const,
          error: `Computed base version "${base}" is invalid for project ${project.name}`,
        };
      }

      const version = format_prerelease(base, channel, id);

      logger.note(
        `${project.name}@${version}`,
        `current: ${current_version}\nbase: ${base}\npre-release: ${version}`,
      );

      if (dry_run) {
        applied.push(`${project.name}@${version}`);
        continue;
      }

      for (const component of project.components) {
        for (const part of component.parts) {
          const initial_content = await fs.read_file(part.file);
          if (initial_content === null) {
            continue;
          }
          const updated_content = part.update_version(initial_content, version);
          await fs.write_file(part.file, updated_content);
        }
      }

      applied.push(`${project.name}@${version}`);
    }

    if (dry_run) {
      return {
        status: "success" as const,
        message: `Dry run - would apply: ${applied.join(", ")}`,
      };
    }

    return {
      status: "success" as const,
      message: `Applied pre-release version(s): ${applied.join(", ")}`,
    };
  },
});
