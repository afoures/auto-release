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
import { create_command, type Option } from "../cli.js";
import { exec } from "../utils/exec.js";

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

export interface AppTemplate {
  name: string;
  packages: string[];
  changelog_path: string;
  versioning: "semver" | "calver";
}

type GitProviderAnswers =
  | {
      provider: "github";
      owner: string;
      repo: string;
      token_env: string;
    }
  | {
      provider: "gitlab";
      project_id: string;
      token_env: string;
      host?: string;
    };

export interface GenerateConfigOptions {
  apps: AppTemplate[];
  changes_dir: string;
  release_branch_prefix: string;
  git: GitProviderAnswers;
}

export function generate_config_source(options: GenerateConfigOptions): string {
  const { apps, changes_dir, release_branch_prefix, git } = options;

  const imports: string[] = ['import { define_config } from "auto-release";'];

  if (apps.some((app) => app.versioning === "semver")) {
    imports.push('import { semver } from "auto-release/versioning/semver";');
  }

  if (apps.some((app) => app.versioning === "calver")) {
    imports.push('import { calver } from "auto-release/versioning/calver";');
  }

  if (git.provider === "github") {
    imports.push('import { github } from "auto-release/git/github";');
  } else {
    imports.push('import { gitlab } from "auto-release/git/gitlab";');
  }

  const lines: string[] = [...imports, "", "export default define_config({"];
  lines.push(`  changes_dir: ${JSON.stringify(changes_dir)},`);
  lines.push(`  release_branch_prefix: ${JSON.stringify(release_branch_prefix)},`);

  lines.push("  apps: [");
  apps.forEach((app, index) => {
    lines.push("    {");
    lines.push(`      name: ${JSON.stringify(app.name)},`);
    lines.push("      packages: [");
    app.packages.forEach((pkg) => {
      lines.push(`        ${JSON.stringify(pkg)},`);
    });
    lines.push("      ],");
    lines.push(`      versioning: ${app.versioning === "semver" ? "semver()" : "calver()"},`);
    lines.push("      changelog: {");
    lines.push(`        path: ${JSON.stringify(app.changelog_path)},`);
    lines.push("      },");
    lines.push(index === apps.length - 1 ? "    }" : "    },");
  });
  lines.push("  ],");

  if (git.provider === "github") {
    lines.push("  git: github({");
    lines.push(`    token: process.env.${git.token_env}!,`);
    lines.push(`    owner: ${JSON.stringify(git.owner)},`);
    lines.push(`    repo: ${JSON.stringify(git.repo)},`);
    lines.push("  }),");
  } else {
    lines.push("  git: gitlab({");
    lines.push(`    token: process.env.${git.token_env}!,`);
    lines.push(`    project_id: ${JSON.stringify(git.project_id)},`);
    if (git.host) {
      lines.push(`    host: ${JSON.stringify(git.host)},`);
    }
    lines.push("  }),");
  }

  lines.push("});", "");

  return lines.join("\n");
}

const PACKAGE_MANAGER_LOCKS: Record<PackageManager, string[]> = {
  npm: ["package-lock.json"],
  pnpm: ["pnpm-lock.yaml"],
  yarn: ["yarn.lock"],
  bun: ["bun.lockb", "bun.lock"],
};

function normalize_app_name(input: string): string {
  const trimmed = input.trim();
  const slug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "app";
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
      return "pnpm add -D auto-release";
    case "yarn":
      return "yarn add -D auto-release";
    case "bun":
      return "bun add -d auto-release";
    default:
      return "npm install --save-dev auto-release";
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
  apps: AppTemplate[],
): Promise<void> {
  const root_dir = join(cwd, changes_dir);
  await mkdir(root_dir, { recursive: true });

  for (const app of apps) {
    await mkdir(join(root_dir, app.name), { recursive: true });
  }
}

async function ensure_changelog(app: AppTemplate, cwd: string): Promise<void> {
  const absolute_path = join(cwd, app.changelog_path);
  await mkdir(dirname(absolute_path), { recursive: true });
  if (!(await path_exists(absolute_path))) {
    const content = `# ${app.name} changelog\n\nAll notable changes to this project will be documented in this file.\n`;
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

const INIT_SCHEMA: Record<string, Option> = {};

export const init = create_command({
  name: "init",
  description: "Set up auto-release in the current repository",
  schema: INIT_SCHEMA,
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
        Boolean(package_json.dependencies?.["auto-release"]) ||
        Boolean(package_json.devDependencies?.["auto-release"]);

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
      const release_branch_prefix = (release_prefix_input as string).trim();

      const app_count_input = await text({
        message: "How many apps should auto-release manage?",
        initialValue: "1",
        validate: (value = "") => {
          const parsed = Number.parseInt(value, 10);
          return Number.isNaN(parsed) || parsed <= 0 ? "Enter a positive number" : undefined;
        },
      });
      if (isCancel(app_count_input)) {
        cancel("Initialization cancelled");
        return { status: "success" as const };
      }
      const app_count = Number.parseInt(app_count_input as string, 10);

      const apps: AppTemplate[] = [];
      for (let index = 0; index < app_count; index++) {
        const default_name =
          index === 0 && package_json.name
            ? normalize_app_name(package_json.name)
            : `app-${index + 1}`;
        const app_name_input = await text({
          message: `App #${index + 1} name (lowercase, no spaces)`,
          initialValue: default_name,
          validate: (value = "") =>
            value.trim().length === 0 ? "App name is required" : undefined,
        });
        if (isCancel(app_name_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }
        const app_name = normalize_app_name(app_name_input as string);

        const package_paths_input = await text({
          message: `Package paths for ${app_name} (comma separated)`,
          initialValue: app_count === 1 ? "." : `apps/${app_name}`,
          validate: (value = "") =>
            value.trim().length === 0 ? "At least one package path is required" : undefined,
        });
        if (isCancel(package_paths_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }
        const package_paths = (package_paths_input as string)
          .split(",")
          .map((path) => path.trim())
          .filter(Boolean);

        const changelog_input = await text({
          message: `Changelog path for ${app_name}`,
          initialValue: app_count === 1 ? "CHANGELOG.md" : `apps/${app_name}/CHANGELOG.md`,
          validate: (value = "") =>
            value.trim().length === 0 ? "Changelog path is required" : undefined,
        });
        if (isCancel(changelog_input)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }
        const changelog_path = (changelog_input as string).trim();

        const version_choice = await select({
          message: `Versioning strategy for ${app_name}`,
          initialValue: "semver",
          options: [
            { value: "semver", label: "Semver (1.2.3)" },
            { value: "calver", label: "Calver (YYYY.MM.micro)" },
          ],
        });
        if (isCancel(version_choice)) {
          cancel("Initialization cancelled");
          return { status: "success" as const };
        }

        apps.push({
          name: app_name,
          packages: package_paths,
          changelog_path,
          versioning: version_choice as AppTemplate["versioning"],
        });
      }

      const git_choice = await select({
        message: "Which git provider do you use?",
        options: [
          { value: "github", label: "GitHub" },
          { value: "gitlab", label: "GitLab" },
        ],
      });
      if (isCancel(git_choice)) {
        cancel("Initialization cancelled");
        return { status: "success" as const };
      }

      let git_answers: GitProviderAnswers;
      const git_provider = git_choice as "github" | "gitlab";
      if (git_provider === "github") {
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
            : apps[0]?.name || "",
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
          provider: "github",
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
          provider: "gitlab",
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
        apps,
        changes_dir,
        release_branch_prefix,
        git: git_answers,
      });
      await writeFile(config_path, config_source, "utf-8");

      await create_changes_directories(context.cwd, changes_dir, apps);
      for (const app of apps) {
        await ensure_changelog(app, context.cwd);
      }

      log.success("Generated auto-release.config.ts");
      log.success(`Change files directory: ${changes_dir}`);
      apps.forEach((app) => {
        log.success(`App ${app.name} ready with ${app.packages.length} package(s)`);
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
