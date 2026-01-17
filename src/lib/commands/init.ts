import { constants as fs_constants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  intro,
  outro,
  text,
  select,
  confirm,
  spinner,
  cancel,
  log,
  isCancel,
} from "@clack/prompts";
import { create_command } from "../cli.ts";
import { exec } from "../utils/exec.ts";

type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

export interface ProjectTemplate {
  name: string;
  components: Array<{ type: "node" | "bun" | "expo" | "php"; path: string }>;
  changelog_path: string;
  versioning: "semver" | "calver" | "markver";
}

type GitPlatformClientAnswers =
  | {
      platform: "github";
      owner: string;
      repo: string;
      token_env: string;
    }
  | {
      platform: "gitlab";
      project_id: string;
      token_env: string;
      host?: string;
    };

export interface GenerateConfigOptions {
  projects: ProjectTemplate[];
  changes_dir: string;
  target_branch: string;
  default_release_branch_prefix: string;
  git: GitPlatformClientAnswers;
}

export function generate_config_source(options: GenerateConfigOptions): string {
  const { projects, changes_dir, target_branch, default_release_branch_prefix, git } = options;

  const imports: string[] = ['import { define_config } from "@afoures/auto-release";'];

  // Collect needed component imports
  const component_types = new Set<string>();
  for (const project of projects) {
    for (const component of project.components) {
      component_types.add(component.type);
    }
  }
  if (component_types.size > 0) {
    const components = Array.from(component_types).sort();
    imports.push(`import { ${components.join(", ")} } from "@afoures/auto-release/components";`);
  }

  // Collect needed versioning imports
  const versioning_types = new Set<string>();
  for (const project of projects) {
    versioning_types.add(project.versioning);
  }
  if (versioning_types.size > 0) {
    const versioning = Array.from(versioning_types).sort();
    imports.push(`import { ${versioning.join(", ")} } from "@afoures/auto-release/versioning";`);
  }

  if (git.platform === "github") {
    imports.push('import { github } from "@afoures/auto-release/platforms";');
  } else {
    imports.push('import { gitlab } from "@afoures/auto-release/platforms";');
  }

  const lines: string[] = [...imports, "", "export default define_config({"];

  // Only include changes_dir if it's not the default
  if (changes_dir !== ".changes") {
    lines.push(`  changes_dir: ${JSON.stringify(changes_dir)},`);
  }

  lines.push("  projects: {");
  projects.forEach((project, index) => {
    lines.push(`    ${JSON.stringify(project.name)}: {`);
    lines.push("      components: [");
    project.components.forEach((component) => {
      lines.push(`        ${component.type}(${JSON.stringify(component.path)}),`);
    });
    lines.push("      ],");
    lines.push(`      versioning: ${project.versioning}(),`);
    lines.push(`      changelog: ${JSON.stringify(project.changelog_path)},`);
    lines.push(index === projects.length - 1 ? "    }," : "    },");
  });
  lines.push("  },");

  lines.push("  git: {");
  if (git.platform === "github") {
    lines.push("    platform: github({");
    lines.push(`      token: process.env.${git.token_env}!,`);
    lines.push(`      owner: ${JSON.stringify(git.owner)},`);
    lines.push(`      repo: ${JSON.stringify(git.repo)},`);
    lines.push("    }),");
  } else {
    lines.push("    platform: gitlab({");
    lines.push(`      token: process.env.${git.token_env}!,`);
    lines.push(`      project_id: ${JSON.stringify(git.project_id)},`);
    if (git.host) {
      lines.push(`      host: ${JSON.stringify(git.host)},`);
    }
    lines.push("    }),");
  }

  // Only include target_branch if it's not the default
  if (target_branch !== "main") {
    lines.push(`    target_branch: ${JSON.stringify(target_branch)},`);
  }

  // Only include default_release_branch_prefix if it's not the default
  if (default_release_branch_prefix !== "release") {
    lines.push(
      `    default_release_branch_prefix: ${JSON.stringify(default_release_branch_prefix)},`,
    );
  }

  lines.push("  },");

  lines.push("});", "");

  return lines.join("\n");
}

const PACKAGE_MANAGER_LOCKS: Record<PackageManager, string[]> = {
  npm: ["package-lock.json"],
  pnpm: ["pnpm-lock.yaml"],
  yarn: ["yarn.lock"],
  bun: ["bun.lockb", "bun.lock"],
};

function normalize_project_name(input: string): string {
  const trimmed = input.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "project";
}

async function path_exists(target: string): Promise<boolean> {
  try {
    await access(target, fs_constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function detect_package_manager(
  cwd: string,
  package_json?: PackageJson,
): Promise<PackageManager | undefined> {
  if (package_json?.packageManager) {
    const [manager] = package_json.packageManager.split("@");
    if (manager === "pnpm" || manager === "npm" || manager === "yarn" || manager === "bun") {
      return manager;
    }
  }

  for (const [manager, locks] of Object.entries(PACKAGE_MANAGER_LOCKS)) {
    for (const lock of locks) {
      if (await path_exists(join(cwd, lock))) {
        return manager as PackageManager;
      }
    }
  }

  return undefined;
}

function get_install_command(package_manager: PackageManager): string {
  switch (package_manager) {
    case "pnpm":
      return "pnpm add -D @afoures/auto-release";
    case "yarn":
      return "yarn add -D @afoures/auto-release";
    case "bun":
      return "bun add -d @afoures/auto-release";
    default:
      return "npm install --save-dev @afoures/auto-release";
  }
}

async function ensure_package_json(path: string): Promise<PackageJson> {
  if (await path_exists(path)) {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as PackageJson;
  }

  const project_name = basename(dirname(path)).replace(/[^a-zA-Z0-9-_]/g, "-");
  const template: PackageJson = {
    name: project_name.toLowerCase(),
    version: "0.1.0",
    private: true,
  };

  await writeFile(path, JSON.stringify(template, null, 2) + "\n", "utf-8");
  log.info(`Created package.json for ${template.name}`);
  return template;
}

async function create_changes_directories(
  cwd: string,
  changes_dir: string,
  projects: ProjectTemplate[],
): Promise<void> {
  const root_dir = join(cwd, changes_dir);
  await mkdir(root_dir, { recursive: true });

  for (const project of projects) {
    await mkdir(join(root_dir, project.name), { recursive: true });
  }
}

async function ensure_changelog(project: ProjectTemplate, cwd: string): Promise<void> {
  const absolute_path = join(cwd, project.changelog_path);
  await mkdir(dirname(absolute_path), { recursive: true });
  if (!(await path_exists(absolute_path))) {
    const content = `# ${project.name} changelog\n\nAll notable changes to this project will be documented in this file.\n`;
    await writeFile(absolute_path, content, "utf-8");
  }
}

function sanitize_env_var(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed.replace(/[^a-zA-Z0-9_]/g, "_").toUpperCase();
}

export const init = create_command({
  name: "init",
  description: "Set up auto-release in the current repository",
  schema: {},
  get_context: async ({ cwd }) => {
    return { cwd };
  },
  run: async ({ context }) => {
    intro("auto-release init");
    try {
      const package_json_path = join(context.cwd, "package.json");
      const package_json = await ensure_package_json(package_json_path);

      let package_manager = await detect_package_manager(context.cwd, package_json);
      if (!package_manager) {
        const selection = await select({
          message: "Select your package manager",
          options: [
            { value: "pnpm", label: "pnpm" },
            { value: "npm", label: "npm" },
            { value: "yarn", label: "yarn" },
            { value: "bun", label: "bun" },
          ],
        });
        if (isCancel(selection)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }
        package_manager = selection as PackageManager;
      }

      if (!package_manager) {
        throw new Error("Package manager selection failed");
      }

      const has_dependency =
        Boolean(package_json.dependencies?.["@afoures/auto-release"]) ||
        Boolean(package_json.devDependencies?.["@afoures/auto-release"]);

      if (!has_dependency) {
        const install_spinner = spinner();
        install_spinner.start("Installing auto-release...");
        try {
          await exec(get_install_command(package_manager), {
            cwd: context.cwd,
          });
          install_spinner.stop("Installed auto-release");
        } catch (error: any) {
          install_spinner.stop("Failed to install auto-release");
          throw new Error(`Dependency installation failed: ${error.message || error}`);
        }
      } else {
        log.info("auto-release already present in package.json");
      }

      const changes_dir_input = await text({
        message: "Where should change files live?",
        initialValue: ".changes",
        validate: (value = "") =>
          value.trim().length === 0 ? "Directory cannot be empty" : undefined,
      });
      if (isCancel(changes_dir_input)) {
        cancel("Initialization cancelled");
        return { status: "success" as const };
      }
      const changes_dir = (changes_dir_input as string).trim();

      const release_prefix_input = await text({
        message: "Release branch prefix",
        initialValue: "release",
        validate: (value = "") =>
          value.trim().length === 0 ? "Release branch prefix cannot be empty" : undefined,
      });
      if (isCancel(release_prefix_input)) {
        cancel("Initialization cancelled");
        return { status: "success" as const };
      }
      const default_release_branch_prefix = (release_prefix_input as string).trim();

      const target_branch_input = await text({
        message: "Target branch (main branch for PRs)",
        initialValue: "main",
        validate: (value = "") =>
          value.trim().length === 0 ? "Target branch cannot be empty" : undefined,
      });
      if (isCancel(target_branch_input)) {
        cancel("Initialization cancelled");
        return { status: "success" as const };
      }
      const target_branch = (target_branch_input as string).trim();

      const project_count_input = await text({
        message: "How many projects should auto-release manage?",
        initialValue: "1",
        validate: (value = "") => {
          const parsed = Number.parseInt(value, 10);
          return Number.isNaN(parsed) || parsed <= 0 ? "Enter a positive number" : undefined;
        },
      });
      if (isCancel(project_count_input)) {
        cancel("Initialization cancelled");
        return { status: "success" as const };
      }
      const project_count = Number.parseInt(project_count_input as string, 10);

      const projects: ProjectTemplate[] = [];
      for (let index = 0; index < project_count; index++) {
        const default_name =
          index === 0 && package_json.name
            ? normalize_project_name(package_json.name)
            : `project-${index + 1}`;
        const project_name_input = await text({
          message: `Project #${index + 1} name (lowercase, no spaces)`,
          initialValue: default_name,
          validate: (value = "") =>
            value.trim().length === 0 ? "Project name is required" : undefined,
        });
        if (isCancel(project_name_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }
        const project_name = normalize_project_name(project_name_input as string);

        const component_count_input = await text({
          message: `How many components for ${project_name}?`,
          initialValue: "1",
          validate: (value = "") => {
            const parsed = Number.parseInt(value, 10);
            return Number.isNaN(parsed) || parsed <= 0 ? "Enter a positive number" : undefined;
          },
        });
        if (isCancel(component_count_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }
        const component_count = Number.parseInt(component_count_input as string, 10);

        const components: Array<{ type: "node" | "bun" | "expo" | "php"; path: string }> = [];
        for (let comp_index = 0; comp_index < component_count; comp_index++) {
          const component_type_choice = await select({
            message: `Component #${comp_index + 1} type for ${project_name}`,
            options: [
              { value: "node", label: "Node (package.json)" },
              { value: "bun", label: "Bun (package.json)" },
              { value: "expo", label: "Expo (package.json + app.json)" },
              { value: "php", label: "PHP (composer.json)" },
            ],
          });
          if (isCancel(component_type_choice)) {
            cancel("Initialization cancelled");
            return { status: "success" as const };
          }
          const component_type = component_type_choice as "node" | "bun" | "expo" | "php";

          const default_path = ".";
          const component_path_input = await text({
            message: `Component #${comp_index + 1} path for ${project_name}`,
            initialValue: default_path,
            validate: (value = "") =>
              value.trim().length === 0 ? "Component path is required" : undefined,
          });
          if (isCancel(component_path_input)) {
            cancel("Initialization cancelled");
            return { status: "success" as const };
          }
          const component_path = (component_path_input as string).trim();

          components.push({
            type: component_type,
            path: component_path,
          });
        }

        const changelog_input = await text({
          message: `Changelog path for ${project_name}`,
          initialValue: project_count === 1 ? "CHANGELOG.md" : `${project_name}/CHANGELOG.md`,
          validate: (value = "") =>
            value.trim().length === 0 ? "Changelog path is required" : undefined,
        });
        if (isCancel(changelog_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }
        const changelog_path = (changelog_input as string).trim();

        const version_choice = await select({
          message: `Versioning strategy for ${project_name}`,
          initialValue: "semver",
          options: [
            { value: "semver", label: "Semver (1.2.3) - major, minor, patch" },
            { value: "calver", label: "Calver (YYYY.MM.micro) - feature, fix" },
            { value: "markver", label: "Markver (1.0.0) - marketing, feature, fix" },
          ],
        });
        if (isCancel(version_choice)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }

        projects.push({
          name: project_name,
          components,
          changelog_path,
          versioning: version_choice as ProjectTemplate["versioning"],
        });
      }

      const git_choice = await select({
        message: "Which git platform do you use?",
        options: [
          { value: "github", label: "GitHub" },
          { value: "gitlab", label: "GitLab" },
        ],
      });
      if (isCancel(git_choice)) {
        cancel("Initialization cancelled");
        return { status: "success" as const };
      }

      let git_answers: GitPlatformClientAnswers;
      const git_platform = git_choice as "github" | "gitlab";
      if (git_platform === "github") {
        const owner_input = await text({
          message: "GitHub owner (user or org)",
          initialValue: package_json.name?.replace(/@.*\//, "") || "",
          validate: (value = "") => (value.trim().length === 0 ? "Owner is required" : undefined),
        });
        if (isCancel(owner_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }

        const repo_input = await text({
          message: "GitHub repository name",
          initialValue: package_json.name
            ? package_json.name.replace(/^@[^/]+\//, "")
            : projects[0]?.name || "",
          validate: (value = "") =>
            value.trim().length === 0 ? "Repository is required" : undefined,
        });
        if (isCancel(repo_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }

        const token_env_input = await text({
          message: "Environment variable for the GitHub token",
          initialValue: "GITHUB_TOKEN",
        });
        if (isCancel(token_env_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }

        git_answers = {
          platform: "github",
          owner: (owner_input as string).trim(),
          repo: (repo_input as string).trim(),
          token_env: sanitize_env_var(token_env_input as string, "GITHUB_TOKEN"),
        };
      } else {
        const project_input = await text({
          message: "GitLab project ID (group/name or numeric)",
          validate: (value = "") =>
            value.trim().length === 0 ? "Project ID is required" : undefined,
        });
        if (isCancel(project_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }

        const host_input = await text({
          message: "GitLab host (optional)",
          initialValue: "gitlab.com",
        });
        if (isCancel(host_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }

        const token_env_input = await text({
          message: "Environment variable for the GitLab token",
          initialValue: "GITLAB_TOKEN",
        });
        if (isCancel(token_env_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }

        git_answers = {
          platform: "gitlab",
          project_id: (project_input as string).trim(),
          host: (host_input as string).trim() || undefined,
          token_env: sanitize_env_var(token_env_input as string, "GITLAB_TOKEN"),
        };
      }

      const config_path = join(context.cwd, "auto-release.config.ts");
      if (await path_exists(config_path)) {
        const overwrite_result = await confirm({
          message: "auto-release.config.ts already exists. Overwrite?",
          initialValue: false,
        });
        if (isCancel(overwrite_result)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }
        const overwrite = Boolean(overwrite_result);
        if (!overwrite) {
          log.info("Skipped config generation");
          outro("auto-release init finished without changes");
          return { status: "success" as const };
        }
      }

      const config_source = generate_config_source({
        projects: projects,
        changes_dir,
        target_branch,
        default_release_branch_prefix,
        git: git_answers,
      });
      await writeFile(config_path, config_source, "utf-8");

      await create_changes_directories(context.cwd, changes_dir, projects);
      for (const project of projects) {
        await ensure_changelog(project, context.cwd);
      }

      log.success("Generated auto-release.config.ts");
      log.success(`Change files directory: ${changes_dir}`);
      projects.forEach((project) => {
        log.success(`Project ${project.name} ready with ${project.components.length} component(s)`);
      });

      outro("auto-release init complete!");
      return {
        status: "success" as const,
        message: "auto-release initialized",
      };
    } catch (error: any) {
      log.error(error.message);
      cancel("Init failed");
      return {
        status: "error" as const,
        error: error.message,
      };
    }
  },
});
