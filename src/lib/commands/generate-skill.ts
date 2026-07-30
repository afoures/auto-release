import { join, relative } from "node:path";
import { create_command } from "../cli.ts";
import { find_nearest_config } from "../config.ts";
import type { InternalConfig } from "../config.ts";
import { read_file, write_file } from "../utils/fs.ts";

/**
 * Name of the generated skill. Doubles as the subfolder name so the skill lives at
 * `<dir>/auto-release/SKILL.md`, matching the Claude Code Agent Skills convention
 * (one folder per skill, named after the skill's frontmatter `name`).
 */
const SKILL_NAME = "auto-release";
const SKILL_FILENAME = "SKILL.md";

/**
 * Markers delimiting the one hand-maintained region of the skill. Everything outside them is
 * regenerated from the config on every run; everything inside is carried over verbatim.
 */
const CUSTOM_START = "<!-- auto-release:custom:start -->";
const CUSTOM_END = "<!-- auto-release:custom:end -->";

/** Default body of the custom region, used when generating a fresh skill. */
const DEFAULT_CUSTOM_SECTION = [
  "Change content is copied into the changelog **verbatim** - exactly as written, with no",
  "markup added or removed. Any of these is acceptable (use whichever your repo prefers):",
  "",
  "- a single bullet - `- Fix login redirect loop`",
  "- a bullet with an indented body paragraph (indent the body two spaces)",
  "- plain prose with no bullet - rendered as-is",
  "",
  "Do **not** assume a leading `- ` is required; only add one if you actually want a bullet.",
].join("\n");

/**
 * Pull the hand-maintained region out of an existing `SKILL.md` so a regeneration can keep it.
 *
 * Prefers the explicit markers. Files generated before the markers existed are handled by
 * falling back to the whole `## Change file format` section body (minus the maintainer note,
 * which the generated shell re-adds).
 */
export function extract_custom_section(existing: string): string | null {
  const start = existing.indexOf(CUSTOM_START);
  const end = existing.indexOf(CUSTOM_END, start + CUSTOM_START.length);
  if (start !== -1 && end !== -1) {
    return existing.slice(start + CUSTOM_START.length, end).trim() || null;
  }

  const legacy = existing.match(/^## Change file format\s*$([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m);
  if (!legacy) {
    return null;
  }
  return (
    legacy[1]
      // Drop the maintainer instructions comment - the generated shell owns it now.
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim() || null
  );
}

/**
 * Build a project-aware Claude Code `SKILL.md` from the loaded config. The skill teaches an
 * agent to record change files for *this* repository, embedding the real project names,
 * valid change types, and change-file directory.
 */
export function generate_skill_source(
  config: InternalConfig,
  options?: { custom_section?: string | null },
): string {
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
    "<!-- Maintainers: edit the section between the markers below to describe your repo's",
    "     preferred change-file style. The agent will follow whatever you write there, and",
    "     re-running `auto-release generate-skill` keeps it while refreshing the rest. -->",
    "",
    CUSTOM_START,
    options?.custom_section ?? DEFAULT_CUSTOM_SECTION,
    CUSTOM_END,
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
      description: "Reset the customisable section to its default instead of preserving it",
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

    const existing = await read_file(skill_path);
    // Regenerating in place is the normal path: the config-derived sections are refreshed and
    // the hand-maintained region is carried over. `--force` opts out and restores the default.
    const custom_section = existing && !args.force ? extract_custom_section(existing) : null;

    const source = generate_skill_source(config, { custom_section });

    try {
      await write_file(skill_path, source);
      const path = relative(root, skill_path);
      return {
        status: "success" as const,
        message: existing
          ? custom_section
            ? `Updated skill: ${path} (kept your customised change-file format section)`
            : `Updated skill: ${path}`
          : `Generated skill: ${path}`,
      };
    } catch (error: any) {
      return {
        status: "error" as const,
        error: `Failed to write skill file: ${error.message}`,
      };
    }
  },
});
