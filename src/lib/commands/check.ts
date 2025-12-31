import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import type { ManagedApplication } from "../types.ts";
import { join } from "node:path";
import * as fs from "../utils/fs.ts";
import { find_change_files } from "../change-file.ts";

async function verify_component_version_consistency(
  app: ManagedApplication,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const versions = new Set<string>();
  const errors: string[] = [];
  for (const component of app.components) {
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
    errors.push(`application ${app.name} has no versions`);
    return { ok: false, errors };
  }
  if (versions.size > 1) {
    errors.push(
      `application ${app.name} has multiple versions: ${Array.from(versions).join(", ")}`,
    );
    return { ok: false, errors };
  }
  return { ok: true };
}

async function validate_changes_files_content(
  changes_dir: string,
  app: ManagedApplication,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const errors: string[] = [];
  const change_files = await find_change_files(join(changes_dir, app.name), {
    allowed_kinds: app.versioning.allowed_changes,
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

export const check = create_command({
  name: "check",
  description: "Validate configuration, packages, and change files",
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

    const config = context.config;

    for (const app of config.managed_applications) {
      const component_validation = await verify_component_version_consistency(app);
      if (!component_validation.ok) {
        errors.push(...component_validation.errors);
      }
      const changes_validation = await validate_changes_files_content(config.changes_dir, app);
      if (!changes_validation.ok) {
        errors.push(...changes_validation.errors);
      }
    }

    const valid = errors.length === 0;

    if (valid) {
      logger.success("All validations passed!");
    } else {
      logger.error("Detected errors:");
      errors.forEach((err) => logger.error(`  ${err}`));
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
