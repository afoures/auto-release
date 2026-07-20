import { join, relative } from "node:path";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import type { InternalConfig } from "../config.ts";
import { exists, write_file } from "../utils/fs.ts";

/**
 * Name of the generated skill. Doubles as the subfolder name so the skill lives at
 * `<dir>/auto-release/SKILL.md`, matching the Claude Code Agent Skills convention
 * (one folder per skill, named after the skill's frontmatter `name`).
 */
const SKILL_NAME = "auto-release";
const SKILL_FILENAME = "SKILL.md";

/**
 * Build a project-aware Claude Code `SKILL.md` from the loaded config. The skill teaches an
 * agent to record change files for *this* repository, embedding the real project names,
 * valid change types, and change-file directory.
 */
export function generate_skill_source(config: InternalConfig): string {
  const projects = config.managed_projects;
  const changes_dir = relative(config.folder, config.changes_dir) || config.changes_dir;

  const single_project = projects.length === 1 ? projects[0] : undefined;
  const project_placeholder = single_project ? single_project.name : "<project>";
  const type_placeholder = single_project
    ? (Array.from(single_project.versioning.allowed_changes)[0] ?? "<type>")
    : "<type>";

  const lines: string[] = [
    "---",
    "name: auto-release",
    "description: Record an auto-release change file whenever you make a user-facing change in",
    "  this repo (a feature, fix, or breaking change), before committing. Use this so the",
    "  change is included in the next release and changelog.",
    "---",
    "",
    "# Recording changes with auto-release",
    "",
    "When you make a user-facing change to this repository, record a change file **before you",
    "commit** so it is included in the next release and changelog.",
    "",
    "## Projects and change types",
    "",
  ];

  for (const project of projects) {
    const types = Array.from(project.versioning.allowed_changes);
    const labelled = types
      .map((type) => {
        const singular = project.versioning.display_map[type]?.singular;
        return singular ? `\`${type}\` (${singular})` : `\`${type}\``;
      })
      .join(", ");
    lines.push(`- \`${project.name}\` - valid types: ${labelled}`);
  }

  lines.push(
    "",
    "## How to record a change (one shot, no prompts)",
    "",
    "```bash",
    `auto-release record-change --project ${project_placeholder} --type ${type_placeholder} --slug <kebab-slug> \\`,
    "  --content $'Short summary of the change.'",
    "```",
    "",
    "Always pass an explicit `--slug` so the filename is deterministic. Change files land in",
    `\`${changes_dir}/<project>/\`. Write the change content in the format described below.`,
    "",
    "## Change file format",
    "",
    "<!-- Maintainers: edit this section to describe your repo's preferred change-file style.",
    "     The agent will follow whatever you write here. -->",
    "",
    "Change content is copied into the changelog **verbatim** - exactly as written, with no",
    "markup added or removed. Any of these is acceptable (use whichever your repo prefers):",
    "",
    "- a single bullet - `- Fix login redirect loop`",
    "- a bullet with an indented body paragraph (indent the body two spaces)",
    "- plain prose with no bullet - rendered as-is",
    "",
    "Do **not** assume a leading `- ` is required; only add one if you actually want a bullet.",
    "",
    "## Verify",
    "",
    "```bash",
    "auto-release check                          # validate config + change files",
    "auto-release generate-release-pr --dry-run  # preview the computed version + changelog",
    "```",
    "",
    "> Run the CLI however this repo exposes it - the installed `auto-release` binary, a package",
    "> script, or `npx @afoures/auto-release <command>`.",
    "",
  );

  return lines.join("\n");
}

export const generate_skill = create_command({
  name: "generate-skill",
  description: "Generate an Agent SKILL.md that teaches agents to record changes for this repo",
  schema: {
    force: {
      type: "boolean",
      description: "Overwrite an existing SKILL.md",
    },
    config: {
      type: "string",
      description: "Path to config file",
      short: "c",
    },
  },
  get_context: async ({ args, cwd }) => {
    const { config, git_root } = await find_nearest_config({
      config_path: args.config,
      cwd,
    });
    return { config, root: git_root || config.folder };
  },
  run: async ({ args, positionals, context: { config, root } }) => {
    const target_dir = positionals[0];
    if (!target_dir) {
      return {
        status: "error" as const,
        error: "a target directory is required (e.g. auto-release generate-skill ./.claude/skills)",
      };
    }

    const skill_dir = join(target_dir, SKILL_NAME);
    const skill_path = join(skill_dir, SKILL_FILENAME);

    if ((await exists(skill_path)) && !args.force) {
      return {
        status: "error" as const,
        error: `${relative(root, skill_path)} already exists. Pass --force to overwrite.`,
      };
    }

    const source = generate_skill_source(config);

    try {
      await write_file(skill_path, source);
      return {
        status: "success" as const,
        message: `Generated skill: ${relative(root, skill_path)}`,
      };
    } catch (error: any) {
      return {
        status: "error" as const,
        error: `Failed to write skill file: ${error.message}`,
      };
    }
  },
});
