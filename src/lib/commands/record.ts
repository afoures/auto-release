import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  text,
  select,
  confirm,
  isCancel,
  intro,
  log,
  cancel,
} from "@clack/prompts";
import { create_command } from "../cli.js";
import { find_nearest_config } from "../config.js";

export const record = create_command({
  name: "record",
  description: "Record a new change",
  schema: {
    app: {
      type: "string",
      description: "App name (will prompt if not provided)",
    },
    type: {
      type: "string",
      description: "Change type (will prompt if not provided)",
    },
    summary: {
      type: "string",
      description: "Summary of the change",
    },
    description: {
      type: "string",
      description: "Detailed description",
    },
    config: {
      type: "string",
      description: "Path to config file",
    },
  },
  get_context: async ({ args, cwd }) => {
    const { config, root_dir } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config, root_dir };
  },
  run: async ({ args, context }) => {
    const cwd = context.root_dir;
    intro(`record a new change`);

    const config = context.config;

    // Determine app
    let app_name = args.app;
    if (!app_name) {
      const app_names = config.managed_applications.map((app) => app.name);
      if (app_names.length === 1) {
        app_name = app_names[0];
        log.success(`Defaulting to app: ${app_name}`);
      } else {
        const selected = await select({
          message: "Select app:",
          options: app_names.map((name) => ({ value: name, label: name })),
        });
        if (isCancel(selected)) {
          cancel("App selection cancelled");
          return {
            status: "success" as const,
          };
        }
        app_name = selected as string;
      }
    }

    const app = config.managed_applications.find(
      (item) => item.name === app_name
    );
    if (!app) {
      return {
        status: "error" as const,
        error: `App "${app_name}" not found in config`,
      };
    }

    // Get valid change types from the versioning strategy
    const valid_types = Array.from(app.versioning.allowed_changes);

    // Determine change type
    let change_type = args.type;
    if (!change_type) {
      const selected = await select({
        message: "Select change type:",
        options: valid_types.map((t) => ({ value: t, label: t })),
      });
      if (isCancel(selected)) {
        cancel("Change type selection cancelled");
        return {
          status: "success" as const,
        };
      }
      change_type = selected as string;
    }

    if (!valid_types.includes(change_type)) {
      return {
        status: "error" as const,
        error: `Invalid change type "${change_type}". Valid types for ${app_name}: ${valid_types.join(
          ", "
        )}`,
      };
    }

    // Get summary
    let summary = args.summary;
    if (!summary) {
      const input = await text({
        message: "Enter summary:",
      });
      if (isCancel(input)) {
        cancel("Summary input cancelled");
        return {
          status: "success" as const,
        };
      }
      summary = input ?? "";
    }

    if (!summary.trim()) {
      return {
        status: "error" as const,
        error: "Summary cannot be empty",
      };
    }

    // Get description (optional)
    let description = args.description;
    if (!description && !args.summary) {
      // Only prompt if not provided via CLI
      const has_description = await confirm({
        message: "Add description?",
        initialValue: false,
      });
      if (!isCancel(has_description) && has_description) {
        const desc_input = await text({
          message: "Enter description:",
        });
        if (!isCancel(desc_input)) {
          description = desc_input;
        }
      }
    }

    // Generate slug from summary and timestamp
    const timestamp = new Date().toISOString().split("T")[0];
    const slug = summary
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 50);
    const full_slug = `${timestamp}-${slug}`;

    // Generate filename
    const filename = `${change_type}.${full_slug}.md`;

    // Generate content
    let content: string;
    if (description?.trim()) {
      content = `# ${summary}\n\n${description}\n`;
    } else {
      content = `${summary}\n`;
    }

    // Write file
    try {
      const changes_dir = join(cwd, config.changes_dir!, app_name);
      await mkdir(changes_dir, { recursive: true });

      const file_path = join(changes_dir, filename);
      await writeFile(file_path, content, "utf-8");

      log.success(`Created change file: ${file_path}`);
      return {
        status: "success" as const,
        message: `Created change file: ${file_path}`,
      };
    } catch (error: any) {
      return {
        status: "error" as const,
        error: `Failed to create change file: ${error.message}`,
      };
    }
  },
});
