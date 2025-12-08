import { validate_packages } from "../packages.js";
import { discover_all_changes } from "../changes.js";
import { create_logger } from "../utils/logger.js";
import { create_command } from "../cli.js";

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
    const package_validation = await validate_packages(config.apps, cwd);
    errors.push(...package_validation.errors);

    // Validate change files
    logger.info("Validating change files...");
    try {
      await discover_all_changes(config.apps, config.changes_dir);
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
