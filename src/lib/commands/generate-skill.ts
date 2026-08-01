import { join, relative } from "node:path";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import type { InternalConfig } from "../config.ts";
import { exists, read_file, write_file } from "../utils/fs.ts";

/**
 * Name of the generated skill. Doubles as the subfolder name so the skill lives at
 * `<dir>/auto-release/SKILL.md`, matching the Claude Code Agent Skills convention
 * (one folder per skill, named after the skill's frontmatter `name`).
 */
const SKILL_NAME = "auto-release";
const SKILL_FILENAME = "SKILL.md";

/**
 * Sibling file holding the repo's change-file house style. Split out of `SKILL.md` on purpose:
 * `SKILL.md` is generated in full and overwritten on every run, while this file is written once
 * and then belongs to the maintainer. Nothing is ever merged, so there is no marker machinery and
 * a drift check is a plain string comparison.
 */
const STYLE_FILENAME = "change-file-format.md";

/** Resolve the `SKILL.md` path for a skills directory (e.g. `./.claude/skills`). */
export function skill_file_path(target_dir: string): string {
  return join(target_dir, SKILL_NAME, SKILL_FILENAME);
}

/** Resolve the house-style file path for a skills directory. */
export function style_file_path(target_dir: string): string {
  return join(target_dir, SKILL_NAME, STYLE_FILENAME);
}

/** Shipped default for `change-file-style.md`, written when the file does not exist yet. */
export const DEFAULT_STYLE_DOC = [
  "# Change file format",
  "",
  "<!-- This file is yours. `auto-release generate-skill` creates it once and never overwrites it",
  "     (unless you pass --force). Describe the change-file style you want agents to follow -",
  "     the generated SKILL.md points here. -->",
  "",
  "Write an imperative title, then an indented paragraph explaining the change:",
  "",
  "```",
  "- Preserve existing indentation when bumping the version in JSON files",
  "",
  "  The bump used to re-serialize with 2-space indentation, producing noisy diffs for projects",
  "  using tabs. The original indentation and trailing-newline style are now kept.",
  "```",
  "",
  "- **Title**: imperative mood (`Add`, `Fix`, `Preserve`), no trailing period.",
  "- **Body**: optional, but write one for anything non-obvious. Leave a blank line above it and",
  "  indent it two spaces. Say what changed and what it replaces - not how it was implemented.",
  "- **Do not restate the change type.** The changelog already groups entries under Features, Bug",
  "  Fixes, and Breaking Changes, so a `Breaking:` or `feat:` prefix in the title is noise.",
  "",
  "Mechanically, content is copied into the changelog **verbatim** - exactly as written, with no",
  "markup added or removed. The leading `- ` and the two-space body indent above are what make it",
  "render as a bullet with a paragraph; nothing forces that shape, so plain prose with no bullet",
  "works too if you prefer it.",
  "",
].join("\n");

/**
 * Build a project-aware Claude Code `SKILL.md` from the loaded config. The skill teaches an
 * agent to record change files for *this* repository, embedding the real project names, valid
 * change types, and change-file directory.
 *
 * Every line here is derived from the config or fixed text - the output is a pure function of the
 * config, which is what lets `--check` compare it byte for byte.
 */
export function generate_skill_source(config: InternalConfig): string {
  const projects = config.managed_projects;
  const changes_dir = relative(config.folder, config.changes_dir) || config.changes_dir;

  const single_project = projects.length === 1 ? projects[0] : undefined;
  const project_placeholder = single_project ? single_project.name : "<project>";
  // Show the least dramatic type in the example - `major` as the sample invocation reads like a
  // recommendation. Strategies that have no `patch` fall back to the last (least severe) type.
  const single_project_types = single_project
    ? Array.from(single_project.versioning.allowed_changes)
    : [];
  const type_placeholder = single_project_types.includes("patch")
    ? "patch"
    : (single_project_types.at(-1) ?? "<type>");

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
    "If the CLI rejects a project or type listed above, this file is stale - re-run",
    "`auto-release generate-skill <skills-dir>` to refresh it.",
    "",
    "## How to record a change (one shot, no prompts)",
    "",
    "```bash",
    `auto-release record-change --project ${project_placeholder} --type ${type_placeholder} --slug <kebab-slug> \\`,
    "  --content $'Short summary of the change.'",
    "```",
    "",
    "Always pass an explicit `--slug` so the filename is deterministic. Change files land in",
    `\`${changes_dir}/<project>/\`.`,
    "",
    "## Change file format",
    "",
    `Read \`${STYLE_FILENAME}\` (next to this file) before writing the change content, and follow`,
    "the house style it describes.",
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

/**
 * Conventional skills directories. `check` only knows about a generated skill if it sits in one
 * of these; anywhere else, wire `generate-skill --check <dir>` into CI explicitly.
 */
const SKILL_SEARCH_DIRS = [".claude/skills", ".agents/skills", "skills"];

/** Locate generated skill folders in the conventional locations under the given roots. */
export async function find_generated_skills(roots: string[]): Promise<string[]> {
  const found = new Set<string>();
  for (const root of new Set(roots.filter(Boolean))) {
    for (const dir of SKILL_SEARCH_DIRS) {
      const target_dir = join(root, dir);
      if (await exists(skill_file_path(target_dir))) {
        found.add(target_dir);
      }
    }
  }
  return Array.from(found);
}

export type SkillDriftStatus =
  /** No `SKILL.md` at that path yet. */
  | "missing"
  /** `SKILL.md` matches the config and the house-style file is present. */
  | "up_to_date"
  /** `SKILL.md` no longer matches what the config generates. */
  | "outdated"
  /** `SKILL.md` is current but its companion house-style file is gone. */
  | "style_missing";

/**
 * Compare a generated skill folder against what the current config would produce.
 *
 * Only `SKILL.md` is compared - the house-style file is maintainer-owned, so its *content* is
 * never drift. Its absence is, because `SKILL.md` links to it.
 */
export function compute_skill_drift(
  config: InternalConfig,
  files: { skill: string | null; style: string | null },
): { status: SkillDriftStatus; expected_skill: string } {
  const expected_skill = generate_skill_source(config);

  if (files.skill === null) {
    return { status: "missing", expected_skill };
  }
  if (files.skill !== expected_skill) {
    return { status: "outdated", expected_skill };
  }
  if (files.style === null) {
    return { status: "style_missing", expected_skill };
  }
  return { status: "up_to_date", expected_skill };
}

/** Human-readable explanation of a drift status, shared by `generate-skill --check` and `check`. */
export function describe_skill_drift(status: SkillDriftStatus, path: string): string | null {
  switch (status) {
    case "up_to_date":
      return null;
    case "missing":
      return `No skill file at ${path}. Run \`auto-release generate-skill <dir>\` to create it.`;
    case "outdated":
      return `Skill at ${path} no longer matches the config. Run \`auto-release generate-skill <dir>\` to refresh it - the file is generated in full, so edit \`${STYLE_FILENAME}\` instead if you want to change what agents are told.`;
    case "style_missing":
      return `Skill at ${path} links to a missing \`${STYLE_FILENAME}\`. Run \`auto-release generate-skill <dir>\` to restore it.`;
  }
}

export const generate_skill = create_command({
  name: "generate-skill",
  description: "Generate an Agent SKILL.md that teaches agents to record changes for this repo",
  schema: {
    force: {
      type: "boolean",
      description: `Overwrite ${STYLE_FILENAME} with the shipped default instead of leaving it alone`,
    },
    check: {
      type: "boolean",
      description:
        "Report whether the skill is up to date instead of writing it (non-zero on drift)",
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

    if (args.check && args.force) {
      return {
        status: "error" as const,
        error: "--check cannot be combined with --force (--check never writes anything)",
      };
    }

    const skill_path = skill_file_path(target_dir);
    const style_path = style_file_path(target_dir);
    const display_path = relative(root, skill_path);

    const [existing_skill, existing_style] = await Promise.all([
      read_file(skill_path),
      read_file(style_path),
    ]);

    if (args.check) {
      const { status } = compute_skill_drift(config, {
        skill: existing_skill,
        style: existing_style,
      });
      const problem = describe_skill_drift(status, display_path);
      return problem
        ? { status: "error" as const, error: problem }
        : { status: "success" as const, message: `Skill is up to date: ${display_path}` };
    }

    // `SKILL.md` is always rewritten in full; the house-style file is only written when it is
    // absent (or when --force asks for a reset), so maintainer edits there are never touched.
    const write_style = existing_style === null || args.force;

    try {
      await write_file(skill_path, generate_skill_source(config));
      if (write_style) {
        await write_file(style_path, DEFAULT_STYLE_DOC);
      }
    } catch (error: any) {
      return {
        status: "error" as const,
        error: `Failed to write skill file: ${error.message}`,
      };
    }

    const style_note = args.force
      ? ` (reset ${STYLE_FILENAME} to the default)`
      : write_style
        ? ` (+ ${STYLE_FILENAME})`
        : ` (kept your ${STYLE_FILENAME})`;

    return {
      status: "success" as const,
      message: `${existing_skill ? "Updated" : "Generated"} skill: ${display_path}${style_note}`,
    };
  },
});
