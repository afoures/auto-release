import { validate_packages } from "../packages.js";
import {
  discover_all_changes,
  parse_change_filename,
  parse_change_markdown,
} from "../changes.js";
import { create_logger } from "../utils/logger.js";
import { create_command } from "../cli.js";
import type { Component, ManagedApplication } from "../types.js";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

function verify_component_version_consistency(
  app: ManagedApplication
): { ok: true } | { ok: false; errors: string[] } {
  const versions = new Set<string>();
  for (const component of app.components) {
    const component_result = component();
    for (const part of component_result.parts) {
      const version = part.get_current_version();
      versions.add(version);
    }
  }

  if (versions.size > 1) {
    return {
      ok: false,
      errors: [
        `Application ${app.name} has multiple versions: ${Array.from(
          versions
        ).join(", ")}`,
      ],
    };
  }
  return { ok: true };
}

function validate_changes_files_content(
  changes_dir: string,
  app: ManagedApplication
): { ok: true } | { ok: false; errors: string[] } {
  const changes_dir_path = join(changes_dir, app.name);
  const changes_files = readdirSync(changes_dir_path);
  const errors: string[] = [];
  for (const change_file of changes_files) {
    if (!change_file.endsWith(".md")) {
      errors.push(`Change file ${change_file} is not a markdown file`);
      continue;
    }

    const change_file_path = join(changes_dir_path, change_file);
    const change_file_parsed = parse_change_filename(change_file);
    if (!change_file_parsed) {
      errors.push(`Change file ${change_file} has an invalid filename format`);
    } else if (
      !app.versioning.allowed_changes.includes(change_file_parsed.kind)
    ) {
      errors.push(`Change file ${change_file} has an invalid kind`);
    }

    const change_file_content = readFileSync(change_file_path, "utf-8");
    const { title, description } = parse_change_markdown(change_file_content);
    if (!title) {
      errors.push(`Change file ${change_file} has no title`);
    }
    if (!description) {
      errors.push(`Change file ${change_file} has no description`);
    }
    if (description.length === 0) {
      errors.push(`Change file ${change_file} has no description`);
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
    json: {
      type: "boolean",
      description: "Output as JSON",
    },
  },
  run: async ({ args, get_config }) => {
    const cwd = process.cwd();
    const json = args.json ?? false;
    const logger = create_logger(json);

    const errors: string[] = [];
    const warnings: string[] = [];

    const config = await get_config();

    // Validate packages
    logger.info("Validating packages...");
    const package_validation = await validate_packages(
      config.managed_applications,
      cwd
    );
    errors.push(...package_validation.errors);

    // Validate change files
    logger.info("Validating change files...");
    try {
      await discover_all_changes(
        config.managed_applications,
        config.changes_dir
      );
    } catch (error: any) {
      errors.push(error.message);
    }

    const valid = errors.length === 0;

    if (json) {
      console.log(JSON.stringify({ valid, errors, warnings }, null, 2));
    } else {
      if (valid) {
        logger.success("All validations passed!");
      } else {
        logger.error("Validation failed:");
        errors.forEach((err) => logger.error(`  ${err}`));
      }

      if (warnings.length > 0) {
        warnings.forEach((warn) => logger.warn(`  ${warn}`));
      }
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
