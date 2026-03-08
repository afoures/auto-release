import { join, relative } from "node:path";
import { select, isCancel, intro, log, cancel, text } from "@clack/prompts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import { ChangeFile, find_change_files, save_change_file } from "../change-file.ts";
import { exec } from "../utils/exec.ts";
import { exists, read_file } from "../utils/fs.ts";
import { spawn } from "node:child_process";
import { humanId as human_id } from "human-id";

async function get_editor_preference(changes_dir: string): Promise<string | null> {
  const prefs_path = join(changes_dir, ".preferences.json");
  if (await exists(prefs_path)) {
    try {
      const content = await read_file(prefs_path);
      if (content === null) {
        return null;
      }
      const prefs = JSON.parse(content);
      return prefs.editor || null;
    } catch {
      return null;
    }
  }
  return null;
}

async function get_editor(changes_dir: string): Promise<string | null> {
  // Check saved preference first
  const saved_editor = await get_editor_preference(changes_dir);
  if (saved_editor) {
    return saved_editor;
  }

  // Check environment variable
  if (process.env.EDITOR) {
    return process.env.EDITOR;
  }

  const common_editors = ["nvim", "vim", "code", "cursor", "nano", "vi"];
  for (const editor of common_editors) {
    try {
      await exec(`which ${editor}`);
      return editor;
    } catch {
      continue;
    }
  }

  return null;
}

function generate_slug(description: string): string {
  return description
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters except word chars, spaces, and hyphens
    .replace(/_/g, "-") // Replace underscores with hyphens
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

async function open_file_with_editor(file_path: string, editor: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Handle VS Code specially (needs -w flag to wait)
    const editor_parts = editor.split(" ");
    const editor_cmd = editor_parts[0];
    const editor_args = editor_parts.slice(1);

    let args: string[];
    if (editor_cmd === "code" || editor_cmd.endsWith("/code")) {
      args = [...editor_args, "-w", file_path];
    } else {
      args = [...editor_args, file_path];
    }

    const proc = spawn(editor_cmd, args, {
      stdio: "inherit",
      shell: false,
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Editor exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

export const record_change = create_command({
  name: "record-change",
  description: "Record a new change",
  schema: {
    project: {
      type: "string",
      description: "Project name",
    },
    type: {
      type: "string",
      description: "Change type",
    },
    config: {
      type: "string",
      description: "Path to config file",
    },
  },
  get_context: async ({ args, cwd }) => {
    const { config, git_root } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config, root: git_root || config.folder };
  },
  run: async ({ args, context }) => {
    intro(`record a new change`);

    const config = context.config;

    // Determine project
    let project_name = args.project;
    if (!project_name) {
      const project_names = config.managed_projects.map((project) => project.name);
      if (project_names.length === 1) {
        project_name = project_names[0];
        log.success(`Defaulting to project: ${project_name}`);
      } else {
        const selected = await select({
          message: "Select project:",
          options: project_names.map((name) => ({ value: name, label: name })),
        });
        if (isCancel(selected)) {
          cancel("Project selection cancelled");
          return {
            status: "success" as const,
          };
        }
        project_name = selected as string;
      }
    }

    const project = config.managed_projects.find((item) => item.name === project_name);
    if (!project) {
      return {
        status: "error" as const,
        error: `Project "${project_name}" not found in config`,
      };
    }

    // Get valid change types from the versioning strategy
    const valid_types = Array.from(project.versioning.allowed_changes);

    // Determine change type
    let change_type = args.type;
    if (!change_type) {
      const selected = await select({
        message: "Select change type:",
        options: valid_types.map((t) => ({
          value: t,
          label: project.versioning.display_map[t]?.singular ?? t,
        })),
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
        error: `Invalid change type "${change_type}". Valid types for ${project_name}: ${valid_types.join(
          ", ",
        )}`,
      };
    }

    const project_change_dir = join(config.changes_dir, project_name);
    const existing_change_files = await find_change_files(project_change_dir, {
      allowed_kinds: valid_types as readonly string[],
    });
    const same_type_change_files = existing_change_files.list.filter((f) => f.kind === change_type);
    const next_index = same_type_change_files.length + 1;

    const initial_slug = human_id({ separator: "-", capitalize: false });

    // Ask user for a description to generate slug
    const description_input = await text({
      message: `Enter a short description for this change: (default: "${initial_slug}")`,
    });

    if (isCancel(description_input)) {
      cancel("Change recording cancelled");
      return {
        status: "success" as const,
      };
    }

    // Generate slug from description
    const slug = generate_slug(description_input as string) || initial_slug;

    // Create change file with empty content (user will edit it)
    const change_file = new ChangeFile({
      kind: change_type,
      index: next_index,
      slug: slug,
      summary: "",
    });

    // Save file
    try {
      const file_path = await save_change_file(change_file, project_change_dir);

      // Open file with editor
      const editor = await get_editor(config.changes_dir);
      if (!editor) {
        return {
          status: "error" as const,
          error: "No editor found, you should update the change file manually.",
        };
      }

      log.info(`Opening file with ${editor}...`);
      await open_file_with_editor(file_path, editor);

      return {
        status: "success" as const,
        message: `Created new change file: ${relative(context.root, file_path)}`,
      };
    } catch (error: any) {
      return {
        status: "error" as const,
        error: `Failed to create change file: ${error.message}`,
      };
    }
  },
});
