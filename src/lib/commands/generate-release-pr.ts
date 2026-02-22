import { join } from "node:path";
import { create_logger } from "../utils/logger.ts";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import * as git from "../utils/git.ts";
import * as fs from "../utils/fs.ts";
import { compute_current_version } from "../utils/version.ts";
import { find_change_files, type ChangeFile } from "../change-file.ts";
import * as mdast from "../utils/mdast.ts";
import { group_projects, type ProjectGroup } from "../utils/group.ts";
import type { ManagedProject } from "../types.ts";

interface ProjectReleaseInfo {
  project: ManagedProject;
  current_version: string;
  next_version: string;
  changes: ChangeFile<string>[];
  file_operations: git.GitFileOperation[];
}

export const generate_release_pr = create_command({
  name: "generate-release-pr",
  description: "Create or update release PRs from change files",
  schema: {
    config: {
      type: "string",
      description: "Path to config file",
    },
    "dry-run": {
      type: "boolean",
      description: "Show what would be done without making changes",
    },
  },
  get_context: async ({ args, cwd }) => {
    const { config, git_root } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config, root: git_root || config.folder };
  },
  run: async ({ args: { "dry-run": dry_run = false }, context: { config, root } }) => {
    const logger = create_logger();

    const project_groups = group_projects(config.managed_projects);

    if (project_groups.length === 0) {
      return {
        status: "success" as const,
        message: "No projects to release",
      };
    }

    for (const group of project_groups) {
      const result = await release_group(group, { config, root, dry_run, logger });

      if (result === "skipped") {
        logger.info(`Skipping group "${group.name}" - no projects with changes`);
        continue;
      }
    }

    if (dry_run) {
      return {
        status: "success" as const,
        message: "Dry run completed - no changes were made",
      };
    }

    return {
      status: "success" as const,
      message: "Release PRs generated successfully",
    };
  },
});

async function release_group(
  group: ProjectGroup,
  {
    config,
    root,
    dry_run,
    logger,
  }: {
    config: {
      git: {
        platform: { create_or_update_branch: any; create_or_update_pull_request: any };
        default_release_branch_prefix: string;
        target_branch: string;
      };
      changes_dir: string;
    };
    root: string;
    dry_run: boolean;
    logger: ReturnType<typeof create_logger>;
  },
): Promise<"processed" | "skipped"> {
  const project_releases: ProjectReleaseInfo[] = [];

  // 1. Collect changes and compute versions for each project
  for (const project of group.projects) {
    const changes_dir = join(config.changes_dir, project.name);
    const changes_result = await find_change_files(changes_dir, {
      allowed_kinds: project.versioning.allowed_changes,
    });

    if (changes_result.warnings.length > 0) {
      for (const warning of changes_result.warnings) {
        logger.warn(warning);
      }
    }

    // Skip projects with no changes if option is set
    if (project.options.skip_release_if_no_change_file && changes_result.list.length === 0) {
      continue;
    }

    const current_version =
      (await compute_current_version(project, {
        get_file_content: (file_path: string) => fs.read_file(file_path),
      })) ?? project.versioning.initial_version;

    const next_version = project.versioning.bump({
      version: current_version,
      changes: changes_result.list,
      date: new Date(),
    });

    // Build formatted message for logging
    const changes_by_kind = new Map<string, Array<ChangeFile<any>>>();
    for (const change of changes_result.list) {
      const existing = changes_by_kind.get(change.kind) ?? [];
      existing.push(change);
      changes_by_kind.set(change.kind, existing);
    }

    const message_lines: string[] = [];
    const display_map = project.versioning.display_map;

    for (const [kind, kind_changes] of changes_by_kind.entries()) {
      const label = display_map[kind]?.plural ?? display_map[kind]?.singular ?? kind;
      message_lines.push(`\n${label}:`);
      for (const change of kind_changes) {
        message_lines.push(`  ${change.summary}`);
      }
    }

    logger.note(`Release ${project.name} ${next_version}`, message_lines.join("\n"));

    if (dry_run) {
      continue;
    }

    // Collect file operations for this project
    const file_operations = await collect_project_file_operations(project, {
      changes_dir,
      changes: changes_result.list,
      current_version,
      next_version,
      root,
    });

    project_releases.push({
      project,
      current_version,
      next_version,
      changes: changes_result.list,
      file_operations,
    });
  }

  // 2. Skip group entirely if no projects have changes
  if (project_releases.length === 0) {
    return "skipped";
  }

  if (dry_run) {
    return "processed";
  }

  // 3. collect all file operations
  const all_file_operations: git.GitFileOperation[] = project_releases.flatMap(
    (release) => release.file_operations,
  );

  // 4. Create branch with all file operations
  const platform = config.git.platform;
  const release_branch_name = `${config.git.default_release_branch_prefix}/${group.name}`;

  await platform.create_or_update_branch({
    branch_name: release_branch_name,
    base_branch_name: config.git.target_branch,
    file_operations: all_file_operations,
    commit_message: `chore: prepare releases for ${group.name}`,
  });

  // 5. Generate PR body with header + all project sections
  const pr_body = generate_pr_body(project_releases);

  // 6. Generate PR title with all projects and versions
  const pr_title = generate_pr_title(project_releases);

  // 7. Create or update PR
  await platform.create_or_update_pull_request({
    head_branch_name: release_branch_name,
    base_branch_name: config.git.target_branch,
    title: pr_title,
    body: pr_body,
    draft: true,
  });

  return "processed";
}

async function collect_project_file_operations(
  project: ManagedProject,
  {
    changes_dir,
    changes,
    current_version: _current_version,
    next_version,
    root,
  }: {
    changes_dir: string;
    changes: ChangeFile<string>[];
    current_version: string;
    next_version: string;
    root: string;
  },
): Promise<git.GitFileOperation[]> {
  // Delete change files
  await fs.delete_all_files_from_folder(changes_dir);

  // Update component files
  for (const component of project.components) {
    for (const part of component.parts) {
      const initial_content = await fs.read_file(part.file);
      if (initial_content === null) {
        continue;
      }
      const updated_content = part.update_version(initial_content, next_version);
      await fs.write_file(part.file, updated_content);
      // TODO: implement component "after" hooks
    }
  }

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
        { version: next_version, changes },
        ...changelog.releases.filter((release) => release.version !== next_version),
      ].sort((a, b) => project.versioning.compare(b.version, a.version)),
    },
    {
      project: { name: project.name },
    },
  );
  await fs.write_file(project.changelog, updated_changelog_content);

  const file_operations = await git.diff(root);
  await git.reset(root);

  return file_operations;
}

function generate_pr_body(project_releases: ProjectReleaseInfo[]): string {
  const header =
    "This PR is managed by [auto-release](https://github.com/afoures/auto-release). Do not edit it manually.";

  const project_bodies = project_releases.map((release) => {
    const formatter = release.project.versioning.formatter;
    return formatter.generate_pr_body({
      project: { name: release.project.name },
      current_version: release.current_version,
      next_version: release.next_version,
      changes: release.changes,
    });
  });

  return [header, ...project_bodies].join("\n\n");
}

function generate_pr_title(project_releases: ProjectReleaseInfo[]): string {
  const release_list = project_releases
    .map((release) => `${release.project.name}@${release.next_version}`)
    .join(", ");

  return `release: ${release_list}`;
}
