import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import type { ManagedProject } from "../types.ts";
import { join } from "node:path";
import * as fs from "../utils/fs.ts";
import { find_change_files } from "../change-file.ts";

async function verify_component_version_consistency(
  project: ManagedProject,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const versions = new Set<string>();
  const errors: string[] = [];
  for (const component of project.components) {
    for (const part of component.parts) {
      const file_content = await fs.read_file(part.file);
      if (file_content === null) {
        errors.push(`component ${component.root} has no version`);
        continue;
      }
      const version = part.get_current_version(file_content);
      versions.add(version);
    }
  }
  if (versions.size === 0) {
    errors.push(`project ${project.name} has no versions`);
    return { ok: false, errors };
  }
  if (versions.size > 1) {
    errors.push(
      `project ${project.name} has multiple versions: ${Array.from(versions).join(", ")}`,
    );
    return { ok: false, errors };
  }
  return { ok: true };
}

async function validate_changes_files_content(
  changes_dir: string,
  project: ManagedProject,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  const change_files = await find_change_files(join(changes_dir, project.name), {
    allowed_kinds: project.versioning.allowed_changes,
  });

  if (change_files.warnings.length > 0) {
    for (const warning of change_files.warnings) {
      errors.push(warning);
    }
  }

  for (const change_file of change_files.list) {
    if (change_file.summary.length === 0) {
      errors.push(`change file ${change_file.filename} has no summary`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

function validate_groups(projects: ManagedProject[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const group_names = new Set(projects.map((p) => p.release_group));

  // Check for group name conflicts with project names
  for (const group_name of group_names) {
    // Check if a group name matches a project name AND that project is not in its own group
    const project_with_same_name = projects.find((p) => p.name === group_name);
    if (project_with_same_name && project_with_same_name.release_group !== group_name) {
      errors.push(
        `Group name "${group_name}" conflicts with project name. Groups and projects must have unique names.`,
      );
    }
  }

  // Warn about similar group names (case insensitive)
  const group_names_array = Array.from(group_names);
  for (let i = 0; i < group_names_array.length; i++) {
    for (let j = i + 1; j < group_names_array.length; j++) {
      const group_a = group_names_array[i];
      const group_b = group_names_array[j];
      if (group_a.toLowerCase() === group_b.toLowerCase() && group_a !== group_b) {
        warnings.push(
          `Groups "${group_a}" and "${group_b}" have similar names (case insensitive match). Consider using consistent casing.`,
        );
      }
    }
  }

  // Warn about group names with special characters
  const special_char_pattern = /[^a-zA-Z0-9_-]/;
  for (const group_name of group_names) {
    if (special_char_pattern.test(group_name)) {
      warnings.push(
        `Group name "${group_name}" contains special characters. Consider using only alphanumeric, hyphens, and underscores for compatibility.`,
      );
    }
  }

  return { errors, warnings };
}

export const check = create_command({
  name: "check",
  description: "Validate configuration, versions, and change files",
  schema: {
    config: {
      type: "string",
      description: "Path to config file",
    },
  },
  get_context: async ({ args, cwd }) => {
    const { config } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config };
  },
  run: async ({ context }) => {
    const logger = create_logger();

    const errors: string[] = [];
    const warnings: string[] = [];

    const config = context.config;

    // Validate groups
    const group_validation = validate_groups(config.managed_projects);
    errors.push(...group_validation.errors);
    warnings.push(...group_validation.warnings);

    for (const project of config.managed_projects) {
      const component_validation = await verify_component_version_consistency(project);
      if (!component_validation.ok) {
        errors.push(...component_validation.errors);
      }
      const changes_validation = await validate_changes_files_content(config.changes_dir, project);
      if (!changes_validation.ok) {
        errors.push(...changes_validation.errors);
      }
    }

    const valid = errors.length === 0;

    if (valid && warnings.length === 0) {
      logger.success("All validations passed!");
    } else if (valid) {
      logger.warn("Validations passed with warnings:");
      warnings.forEach((warning) => logger.warn(`  ${warning}`));
    } else {
      logger.error("Detected errors:");
      errors.forEach((err) => logger.error(`  ${err}`));
      if (warnings.length > 0) {
        logger.warn("Warnings:");
        warnings.forEach((warning) => logger.warn(`  ${warning}`));
      }
    }

    if (valid) {
      return { status: "success" as const, message: "All validations passed!" };
    } else {
      return {
        status: "error" as const,
        error: "Validation failed",
      };
    }
  },
});
