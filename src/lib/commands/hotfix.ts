import { relative } from "node:path";
import { intro, log, cancel, confirm, select, text, isCancel, outro, note } from "@clack/prompts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import { ChangeFile } from "../change-file.ts";
import * as git from "../utils/git.ts";
import * as fs from "../utils/fs.ts";
import { compute_current_version } from "../utils/version.ts";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

export const hotfix = create_command({
  name: "hotfix",
  description: "Create a hotfix release from an old version branch",
  schema: {
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
  run: async ({ context: { config, root } }) => {
    intro("Create a hotfix release");

    // Check for uncommitted changes
    const has_changes = await git.has_uncommitted_changes(root);
    if (has_changes) {
      return {
        status: "error" as const,
        error:
          "You have uncommitted changes. Please commit or stash them before creating a hotfix.",
      };
    }

    // Show current branch
    const current_branch = await git.get_current_branch(root);
    if (!current_branch) {
      return {
        status: "error" as const,
        error: "Not on a branch (detached HEAD). Please checkout a branch first.",
      };
    }
    log.info(`Current branch: ${current_branch}`);

    // Show hotfix instructions
    log.info("Hotfix workflow:");
    log.info("1. You should be on a branch based on an old version");
    log.info("2. The hotfix will create a new version bump from the current version");
    log.info("3. Changes will be committed and tagged locally");
    log.info("4. You'll need to push and merge to main branch");

    // Confirm branch is based on old version
    const branch_confirmation = await confirm({
      message: "Are you currently working on a branch that was based on an old version?",
      initialValue: false,
    });

    if (isCancel(branch_confirmation)) {
      cancel("Hotfix cancelled");
      return {
        status: "success" as const,
      };
    }

    if (!branch_confirmation) {
      return {
        status: "error" as const,
        error: "Hotfix can only be created from a branch based on an old version",
      };
    }

    // Select app
    const app_names = config.managed_applications.map((app) => app.name);
    let app_name: string;
    if (app_names.length === 1) {
      app_name = app_names[0];
      log.success(`Defaulting to app: ${app_name}`);
    } else {
      const selected = await select({
        message: "Select app to hotfix:",
        options: app_names.map((name) => ({ value: name, label: name })),
      });
      if (isCancel(selected)) {
        cancel("Hotfix cancelled");
        return {
          status: "success" as const,
        };
      }
      app_name = selected as string;
    }

    const app = config.managed_applications.find((item) => item.name === app_name);
    if (!app) {
      return {
        status: "error" as const,
        error: `App "${app_name}" not found in config`,
      };
    }

    // Get current version
    const current_version =
      (await compute_current_version(app, {
        get_file_content: (file_path: string) => fs.read_file(file_path),
      })) ?? app.versioning.initial_version;

    log.info(`Current version: ${current_version}`);

    // Ask for hotfix description
    const description_input = await text({
      message: "Enter a description for this hotfix:",
      validate: (value = "") => {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return "Description is required";
        }
        return undefined;
      },
    });

    if (isCancel(description_input)) {
      cancel("Hotfix cancelled");
      return {
        status: "success" as const,
      };
    }

    const hotfix_description = description_input as string;

    // Get hotfix-allowed change types
    const hotfix_allowed_changes = Array.from(app.versioning.hotfix_allowed_changes);
    if (hotfix_allowed_changes.length === 0) {
      return {
        status: "error" as const,
        error: `No hotfix-allowed change types found for app ${app_name}`,
      };
    }

    // Select hotfix change type if multiple options available
    let hotfix_change_type: string;
    if (hotfix_allowed_changes.length === 1) {
      hotfix_change_type = hotfix_allowed_changes[0];
      const display_label =
        app.versioning.display_map[hotfix_change_type]?.singular ?? hotfix_change_type;
      log.success(`Using change type: ${display_label}`);
    } else {
      const selected = await select({
        message: "Select hotfix change type:",
        options: hotfix_allowed_changes.map((kind) => {
          const display_label = app.versioning.display_map[kind]?.singular ?? kind;
          return { value: kind, label: display_label };
        }),
      });
      if (isCancel(selected)) {
        cancel("Hotfix cancelled");
        return {
          status: "success" as const,
        };
      }
      hotfix_change_type = selected as string;
    }

    // Create change file for version calculation (not saved to disk)
    const change_file = new ChangeFile({
      kind: hotfix_change_type,
      summary: hotfix_description,
    });

    // Calculate next version with hotfix reason
    const next_version = app.versioning.bump({
      version: current_version,
      changes: [change_file],
      date: new Date(),
      reason: "hotfix",
    });

    log.info(`Next version will be: ${next_version}`);

    // Check if tag already exists
    const tag = `${app_name}@${next_version}`;
    const tag_exists = await git.tag_exists(tag, root);
    if (tag_exists) {
      return {
        status: "error" as const,
        error: `Tag ${tag} already exists. This version has already been released.`,
      };
    }

    // Show what will be done
    note(
      `Hotfix plan:
- App: ${app_name}
- Current version: ${current_version}
- Next version: ${next_version}
- Description: ${hotfix_description}`,
      "Hotfix details",
    );

    // Confirm before proceeding
    const proceed_confirmation = await confirm({
      message: "Proceed with generating changelog and version bump?",
      initialValue: false,
    });

    if (isCancel(proceed_confirmation) || !proceed_confirmation) {
      cancel("Hotfix cancelled");
      return {
        status: "success" as const,
      };
    }

    // Track files that will be modified
    const files_to_stage: string[] = [];

    // Update components
    for (const component of app.components) {
      for (const part of component.parts) {
        const relative_path = relative(root, part.file);
        const initial_content = await fs.read_file(relative_path);
        if (initial_content === null) {
          continue;
        }
        const updated_content = part.update_version(initial_content, next_version);
        await fs.write_file(relative_path, updated_content);
        files_to_stage.push(relative_path);
      }
    }
    log.success("Updated component versions");

    // Update changelog
    const formatter = app.versioning.formatter;
    const changelog_relative_path = relative(root, app.changelog);
    const initial_changelog_content = (await fs.read_file(changelog_relative_path)) ?? "";
    const changelog_as_mdast = fromMarkdown(initial_changelog_content, {
      extensions: [gfm()],
      mdastExtensions: [gfmFromMarkdown()],
    });
    const changelog = formatter.transform_markdown(changelog_as_mdast);
    const updated_changelog_content = formatter.format_changelog({
      ...changelog,
      releases: [
        { version: next_version, changes: [change_file] },
        ...changelog.releases.filter((release) => release.version !== next_version),
      ].sort((a, b) => app.versioning.compare(a.version, b.version)),
    });
    await fs.write_file(changelog_relative_path, updated_changelog_content);
    files_to_stage.push(changelog_relative_path);
    log.success("Updated changelog");

    // Ask for commit message
    const commit_message_input = await text({
      message: "Enter commit message:",
      placeholder: `chore: hotfix ${app_name}@${next_version}`,
      validate: (value = "") => {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return "Commit message is required";
        }
        return undefined;
      },
    });

    if (isCancel(commit_message_input)) {
      cancel("Hotfix cancelled");
      return {
        status: "success" as const,
      };
    }

    const commit_message = (commit_message_input as string).trim();

    // Stage only the files we modified
    await git.stage_files(files_to_stage, root);
    log.success(`Staged ${files_to_stage.length} file(s)`);

    // Show diff preview
    const diff = await git.get_staged_diff(root);
    if (diff) {
      note(diff, "Changes to be committed");
    }

    const confirm_commit = await confirm({
      message: "Review the changes above. Proceed with commit?",
      initialValue: true,
    });

    if (isCancel(confirm_commit) || !confirm_commit) {
      await git.reset_staged(root);
      cancel("Hotfix cancelled, changes unstaged");
      return {
        status: "success" as const,
      };
    }

    // Commit
    await git.commit(commit_message, root);
    log.success(`Committed: ${commit_message}`);

    // Create tag (moved tag variable declaration earlier)
    const tag_message = `hotfix: ${tag}`;
    await git.create_tag(tag, tag_message, root);
    log.success(`Tagged: ${tag}`);

    // Show final instructions
    outro(`Hotfix ${tag} created successfully!`);

    log.info("Next steps:");
    log.info(`1. Push commit and tag: git push --follow-tags`);
    log.warn("⚠️  Pushing will trigger the release pipeline");
    log.info(`2. Make sure to merge this commit into the ${config.git.target_branch} branch`);

    return {
      status: "success" as const,
      message: `Hotfix ${tag} created successfully`,
    };
  },
});
