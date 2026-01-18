import { join } from "node:path";
import { intro, log, cancel, confirm, select, text, isCancel, outro, note } from "@clack/prompts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import { find_change_files } from "../change-file.ts";
import * as git from "../utils/git.ts";
import * as fs from "../utils/fs.ts";
import { compute_current_version } from "../utils/version.ts";
import { is_ci } from "../utils/branch-protection.ts";
import * as mdast from "../utils/mdast.ts";

export const manual_release = create_command({
  name: "manual-release",
  description: "Create a manual release using change files on disk",
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
    intro("Create a manual release");

    // Prevent execution in CI
    if (is_ci()) {
      return {
        status: "error" as const,
        error:
          "Manual release command cannot be run in CI environments. Use the automated release workflow instead.",
      };
    }

    // Show warning about intended use
    log.warn("⚠️  This command is not the intended use of the auto-release workflow.");
    log.warn(
      "⚠️  The recommended workflow is to use 'record-change' and 'generate-release-pr' commands.",
    );

    // Check for uncommitted changes
    const has_changes = await git.has_uncommitted_changes(root);
    if (has_changes) {
      return {
        status: "error" as const,
        error:
          "You have uncommitted changes. Please commit or stash them before creating a manual release.",
      };
    }

    const proceed_warning = await confirm({
      message: "Do you want to proceed with manual release anyway?",
      initialValue: false,
    });

    if (isCancel(proceed_warning)) {
      cancel("Manual release cancelled");
      return {
        status: "success" as const,
      };
    }

    if (!proceed_warning) {
      return {
        status: "error" as const,
        error: "Manual release cancelled by user",
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

    // Select project
    const project_names = config.managed_projects.map((project) => project.name);
    let project_name: string;
    if (project_names.length === 1) {
      project_name = project_names[0];
      log.success(`Defaulting to project: ${project_name}`);
    } else {
      const selected = await select({
        message: "Select a project to release",
        options: project_names.map((name) => ({ value: name, label: name })),
      });

      if (isCancel(selected)) {
        cancel("Manual release cancelled");
        return { status: "success" as const };
      }

      project_name = selected as string;
    }

    const project = config.managed_projects.find((item) => item.name === project_name);
    if (!project) {
      return {
        status: "error" as const,
        error: `Project "${project_name}" not found in config`,
      };
    }

    // Read change files from disk
    const changes = await find_change_files(join(config.changes_dir, project_name), {
      allowed_kinds: project.versioning.allowed_changes,
    });

    if (changes.warnings.length > 0) {
      for (const warning of changes.warnings) {
        log.warn(warning);
      }
    }

    log.success(`Found ${changes.list.length} change file(s)`);

    // Get current version
    const current_version =
      (await compute_current_version(project, {
        get_file_content: (file_path: string) => fs.read_file(file_path),
      })) ?? project.versioning.initial_version;

    log.info(`Current version: ${current_version}`);

    // Calculate next version
    const next_version_candidate = project.versioning.bump({
      version: current_version,
      changes: changes.list,
      date: new Date(),
    });

    log.info(`Next version will be: ${next_version_candidate}`);

    // Prompt user to optionally override the version
    const version_input = await text({
      message: `Enter version [or press Enter to use ${next_version_candidate}]:`,
      placeholder: next_version_candidate,
      validate: (value = "") => {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return undefined;
        }
        if (!project.versioning.validate({ version: trimmed })) {
          return `Invalid version format. Expected format compatible with ${project.versioning.allowed_changes.join(", ")}`;
        }
        return undefined;
      },
    });

    if (isCancel(version_input)) {
      cancel("Manual release cancelled");
      return {
        status: "success" as const,
      };
    }

    const next_version = (version_input as string).trim() || next_version_candidate;

    log.info(`Using version: ${next_version}`);

    const proposed_tag = config.git.tag_generator({
      project: { name: project.name },
      version: next_version,
    });

    // Ask for tag
    const tag_input = await text({
      message: "Enter tag name:",
      placeholder: proposed_tag,
      initialValue: proposed_tag,
      validate: (value = "") => {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return "Tag name is required";
        }
        return undefined;
      },
    });

    if (isCancel(tag_input)) {
      cancel("Manual release cancelled");
      return {
        status: "success" as const,
      };
    }

    const tag = (tag_input as string).trim();

    // Check if tag already exists locally
    const local_tag_exists = await git.tag_exists(tag, root);
    if (local_tag_exists) {
      return {
        status: "error" as const,
        error: `Tag ${tag} already exists locally. This tag has already been created.`,
      };
    }

    // Check if tag already exists remotely via platform API
    try {
      const existing_tag = await config.git.platform.get_tag({ tag });
      if (existing_tag !== null) {
        // Get current HEAD SHA for comparison
        const { head_sha } = await git.get_head_and_parent_shas(root);
        if (existing_tag.commit_sha === head_sha) {
          return {
            status: "error" as const,
            error: `Tag ${tag} already exists remotely on commit ${head_sha}. This tag has already been created.`,
          };
        } else {
          return {
            status: "error" as const,
            error: `Tag ${tag} already exists remotely but points to different commit (${existing_tag.commit_sha} vs ${head_sha}).`,
          };
        }
      }
    } catch (error: any) {
      // If platform API check fails, log warning but continue
      // (might be network issue or platform not configured)
      log.warn(`Could not check remote tag existence: ${error.message}`);
      log.warn("Continuing with local tag check only...");
    }

    // Show what will be done
    const changes_summary = changes.list
      .map((change) => `  ${change.summary.split("\n").join("\n  ")}`)
      .join("\n");

    note(
      `Manual release plan:
 - Project: ${project_name}
 - Current version: ${current_version}
 - Next version: ${next_version}
 - Tag: ${tag}
 - Change files:
${changes_summary || "  No changes in this release."}`,
      "Release details",
    );

    // Confirm before proceeding
    const proceed_confirmation = await confirm({
      message: "Proceed with generating changelog and version bump?",
      initialValue: false,
    });

    if (isCancel(proceed_confirmation) || !proceed_confirmation) {
      cancel("Manual release cancelled");
      return {
        status: "success" as const,
      };
    }

    // Track files that will be modified
    const files_to_stage: string[] = [];

    // Delete change files
    const changes_dir = join(config.changes_dir, project_name);
    const deleted_change_files = await fs.delete_all_files_from_folder(changes_dir);
    files_to_stage.push(...deleted_change_files);
    log.success(`Deleted ${deleted_change_files.length} change file(s)`);

    // Update components
    for (const component of project.components) {
      for (const part of component.parts) {
        const initial_content = await fs.read_file(part.file);
        if (initial_content === null) {
          continue;
        }
        const updated_content = part.update_version(initial_content, next_version);
        await fs.write_file(part.file, updated_content);
        files_to_stage.push(part.file);
      }
    }
    log.success("Updated component versions");

    // Update changelog
    const formatter = project.versioning.formatter;
    const initial_changelog_content = await fs.read_file(project.changelog);
    const changelog_as_mdast = mdast.parse_markdown(initial_changelog_content ?? "");
    const changelog = formatter.transform_markdown(
      changelog_as_mdast,
      initial_changelog_content ?? "",
    );
    const updated_changelog_content = formatter.format_changelog(
      {
        ...changelog,
        releases: [
          { version: next_version, changes: changes.list },
          ...changelog.releases.filter((release) => release.version !== next_version),
        ].sort((a, b) => project.versioning.compare(b.version, a.version)),
      },
      { project: { name: project_name } },
    );
    await fs.write_file(project.changelog, updated_changelog_content);
    files_to_stage.push(project.changelog);
    log.success("Updated changelog");

    // Ask for commit message
    const commit_message_input = await text({
      message: "Enter commit message:",
      placeholder: `release: ${project_name}@${next_version}`,
      initialValue: `release: ${project_name}@${next_version}`,
      validate: (value = "") => {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return "Commit message is required";
        }
        return undefined;
      },
    });

    if (isCancel(commit_message_input)) {
      cancel("Manual release cancelled");
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
      initialValue: false,
    });

    if (isCancel(confirm_commit) || !confirm_commit) {
      await git.reset(root);
      cancel("Manual release cancelled, resetting changes");
      return {
        status: "success" as const,
      };
    }

    // Commit
    await git.commit(commit_message, root);
    log.success(`Committed: ${commit_message}`);

    // Create tag
    const tag_message = `release: ${tag}`;
    await git.create_tag(tag, tag_message, root);
    log.success(`Tagged: ${tag}`);

    // Show final instructions
    outro(`Manual release ${tag} created successfully!`);

    log.info("Next steps:");
    log.info(`1. Push commit and tag: git push --follow-tags`);
    log.warn("⚠️  Pushing will trigger the release pipeline");

    return {
      status: "success" as const,
      message: `Manual release ${tag} created successfully`,
    };
  },
});
