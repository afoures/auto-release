import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import type { ManagedApplication } from "../types.ts";
import { join } from "node:path";
import * as fs from "../utils/fs.ts";
import { ChangeFile } from "../change-file.ts";

async function verify_component_version_consistency(
  app: ManagedApplication,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const versions = new Set<string>();
  for (const component of app.components) {
    for (const part of component.parts) {
      const file_content = await fs.read_file(part.file);
      const version = part.get_current_version(file_content);
      versions.add(version);
    }
  }
  if (versions.size === 0) {
    return {
      ok: false,
      errors: [`application ${app.name} has no versions`],
    };
  }
  if (versions.size > 1) {
    return {
      ok: false,
      errors: [`application ${app.name} has multiple versions: ${Array.from(versions).join(", ")}`],
    };
  }
  return { ok: true };
}

async function validate_changes_files_content(
  changes_dir: string,
  app: ManagedApplication,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const changes_dir_path = join(changes_dir, app.name);
  const files = await fs.list_files(changes_dir_path);

  const errors: string[] = [];
  for (const file of files) {
    const change_file_or_error = await ChangeFile.from_file(file);
    if (change_file_or_error instanceof Error) {
      errors.push(`change file ${file} is invalid: ${change_file_or_error.message}`);
      continue;
    }
    const change_file = change_file_or_error;
    if (!app.versioning.allowed_changes.includes(change_file.kind)) {
      errors.push(`change file ${file} has an invalid kind: ${change_file.kind}`);
    }
    if (change_file.summary.length === 0) {
      errors.push(`change file ${file} has no summary`);
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
    const warnings: string[] = [];

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
      logger.error("Validation failed:");
      errors.forEach((err) => logger.error(`  ${err}`));
    }

    if (warnings.length > 0) {
      warnings.forEach((warn) => logger.warn(`  ${warn}`));
    }

    if (valid) {
      return { status: "success" as const, message: "All validations passed!" };
    } else {
      return {
        status: "error" as const,
        error: errors.join("; "),
      };
    }
  },
});
