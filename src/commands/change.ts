import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { text, select, confirm, isCancel } from "@clack/prompts";
import { create_logger } from "../utils/logger.js";
import { create_command } from "../cli.js";

export const change = create_command({
  name: "change",
  description: "Create a new change file",
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
  run: async ({ values, config }) => {
    const cwd = process.cwd();
    const logger = create_logger();

    // Determine app
    let app_name = values.app;
    if (!app_name) {
      if (config.apps.length === 1) {
        app_name = config.apps[0].name;
      } else {
        const selected = await select({
          message: "Select app:",
          options: config.apps.map((a) => ({ value: a.name, label: a.name })),
        });
        if (isCancel(selected)) {
          throw new Error("App selection cancelled");
        }
        app_name = selected as string;
      }
    }

    const app = config.apps.find((a) => a.name === app_name);
    if (!app) {
      throw new Error(`App "${app_name}" not found in config`);
    }

    // Get valid change types from the versioning strategy
    const valid_types = Array.from(app.versioning.change_types);

    // Determine change type
    let change_type = values.type;
    if (!change_type) {
      const selected = await select({
        message: "Select change type:",
        options: valid_types.map((t) => ({ value: t, label: t })),
      });
      if (isCancel(selected)) {
        throw new Error("Change type selection cancelled");
      }
      change_type = selected as string;
    }

    if (!valid_types.includes(change_type)) {
      throw new Error(
        `Invalid change type "${change_type}". Valid types for ${app_name}: ${valid_types.join(
          ", "
        )}`
      );
    }

    // Get summary
    let summary = values.summary;
    if (!summary) {
      const input = await text({
        message: "Enter summary:",
      });
      if (isCancel(input)) {
        throw new Error("Summary input cancelled");
      }
      summary = input;
    }

    if (!summary.trim()) {
      throw new Error("Summary cannot be empty");
    }

    // Get description (optional)
    let description = values.description;
    if (!description && !values.summary) {
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
    const changes_dir = join(cwd, config.changes_dir!, app_name);
    await mkdir(changes_dir, { recursive: true });

    const file_path = join(changes_dir, filename);
    await writeFile(file_path, content, "utf-8");

    logger.success(`Created change file: ${file_path}`);
    return { ok: true as const };
  },
});
