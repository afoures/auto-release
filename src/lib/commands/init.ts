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
    }
  | {
      platform: "gitlab";
      project_id: string;
      host?: string;
    };

export interface GenerateConfigOptions {
  projects: ProjectTemplate[];
  changes_dir: string;
  target_branch: string;
  default_release_branch_prefix?: string;
  git: GitPlatformClientAnswers;
}

export function generate_config_source(options: GenerateConfigOptions): string {
  const {
    projects,
    changes_dir,
    target_branch,
    default_release_branch_prefix = "release",
    git,
  } = options;

  const imports: string[] = ['import { define_config } from "@afoures/auto-release";'];

  if (projects.length > 0) {
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

    const versioning_types = new Set<string>();
    for (const project of projects) {
      versioning_types.add(project.versioning);
    }
    if (versioning_types.size > 0) {
      const versioning = Array.from(versioning_types).sort();
      imports.push(`import { ${versioning.join(", ")} } from "@afoures/auto-release/versioning";`);
    }
  }

  if (git.platform === "github") {
    imports.push('import { github } from "@afoures/auto-release/platforms";');
  } else {
    imports.push('import { gitlab } from "@afoures/auto-release/platforms";');
  }

  const lines: string[] = [...imports, "", "export default define_config({"];

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
    lines.push(`      owner: ${JSON.stringify(git.owner)},`);
    lines.push(`      repo: ${JSON.stringify(git.repo)},`);
    lines.push(`      token: undefined,`);
    lines.push("    }),");
  } else {
    lines.push("    platform: gitlab({");
    lines.push(`      project_id: ${JSON.stringify(git.project_id)},`);
    if (git.host) {
      lines.push(`      host: ${JSON.stringify(git.host)},`);
    }
    lines.push(`      token: undefined,`);
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

function get_exec_list_command(package_manager: PackageManager): string {
  switch (package_manager) {
    case "pnpm":
      return "pnpm exec auto-release list";
    case "yarn":
      return "yarn exec auto-release list";
    case "bun":
      return "bunx auto-release list";
    default:
      return "npx auto-release list";
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
          initialValue: package_json.name ? package_json.name.replace(/^@[^/]+\//, "") : "",
          validate: (value = "") =>
            value.trim().length === 0 ? "Repository is required" : undefined,
        });
        if (isCancel(repo_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }

        git_answers = {
          platform: "github",
          owner: (owner_input as string).trim(),
          repo: (repo_input as string).trim(),
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

        git_answers = {
          platform: "gitlab",
          project_id: (project_input as string).trim(),
          host: (host_input as string).trim() || undefined,
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
        projects: [],
        changes_dir,
        target_branch,
        git: git_answers,
      });
      await writeFile(config_path, config_source, "utf-8");

      const root_changes_dir = join(context.cwd, changes_dir);
      await mkdir(root_changes_dir, { recursive: true });

      log.success("Generated auto-release.config.ts");
      log.success(`Change files directory: ${changes_dir}`);

      log.message("");
      log.message("Next: add projects to auto-release.config.ts");
      log.message(
        "  Edit the `projects` object and add entries with components, versioning, and changelog path.",
      );
      log.message(`  Then run \`${get_exec_list_command(package_manager)}\` to verify.`);

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
