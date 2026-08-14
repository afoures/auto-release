# Commands

## `init`

Set up auto-release in your repository:

```bash
auto-release init
```

Interactively configures projects, versioning strategies, and git platform.

## `check`

Validate configuration, change files, and release groups:

```bash
auto-release check
```

**Validations:**

- Component version consistency
- Change file content
- Group name conflicts (group names cannot match project names)
- Similar group names (case-insensitive)
- Group name special characters
- Generated skill freshness, if a [generated skill](#generate-skill) is found in a conventional
  location (`.claude/skills/`, `.agents/skills/`, or `skills/`)

Use in CI to ensure everything is valid before merging.

## `record-change`

Create a new change file:

```bash
# Interactive (prompts for type/description, then opens your editor)
auto-release record-change

# Partially non-interactive (skips the project/type prompts, still opens the editor)
auto-release record-change --project my-app --type minor

# Fully non-interactive - one shot, no editor (for scripts and agents)
auto-release record-change --project my-app --type minor --slug dark-theme-toggle \
  --content $'Add dark mode\n\nUsers can now toggle a dark theme from settings.'
```

**Options:**

- `--project <name>`: Project name (optional if only one project is managed).
- `--type <type>`: Change type (e.g. `minor`, `patch`). Must be valid for the project.
- `--content <text>`: Change content, written to the change file **verbatim** and copied
  into the changelog as-is (start a line with `- ` for a bullet). When provided, the
  editor is skipped, so the command runs to completion without any interaction.
- `--slug <slug>`: Explicit slug for the change filename. Defaults to a slug derived from
  the first line of the content (or the description you type in interactive mode).

**Non-interactive behavior:** when stdin is not a TTY (or the command runs in CI), the
interactive prompts are disabled. If a required value is missing the command exits with a
clear error rather than hanging - for example, omitting `--type` prints
`--type is required in non-interactive mode. Valid types for my-app: major, minor, patch`,
and omitting `--content` prints `--content is required in non-interactive mode`.

## `list`

List all projects managed by `auto-release` with their current versions, grouped by `release_group`:

```bash
auto-release list
```

**Output example:**

```
found 5 projects in 3 groups:

Group: frontend (2 projects)
  web-app (1.2.3)
    ./apps/web/package.json
  mobile-app (2.0.1)
    ./apps/mobile/package.json

Group: api-service (1 project)
  api-service (0.5.0)
    ./services/api/Cargo.toml
```

## `current-version`

Print the current version of registered projects, as raw output meant for scripts and CI steps:

```bash
# Every project, one per line
auto-release current-version

# A single project - prints just the version
auto-release current-version --project my-app

# Machine readable
auto-release current-version --json
```

Without `--project` the format is `<name> <version>`, one line per project:

```
web-app 1.2.3
api 0.5.0
```

With `--project` the output is the bare version (`1.2.3`), and `--json` always emits an **array**,
even for one project, so the shape is stable:

```json
[{ "project": "web-app", "version": "1.2.3" }]
```

The output carries no decoration and no trailing summary line, so it works directly in command
substitution:

```bash
VERSION=$(auto-release current-version --project my-app)
VERSION=$(auto-release current-version --json | jq -r '.[0].version')
```

This reports the version currently written in the component files, **not** the next version your
pending change files would produce - use `generate-release-pr --dry-run` for that. When a project
spans several components, the highest version wins (use [`check`](#check) to catch components that
have drifted apart). A project with no readable component file is an error rather than a fallback to
the initial version.

**Options:**

- `--project <name>`: Only report this project, printing the bare version.
- `--json`: Output a JSON array of `{ project, version }` instead of plain text.

## `generate-release-pr`

Create or update release PRs based on change files:

```bash
# Preview changes
auto-release generate-release-pr --dry-run

# Create/update PRs
auto-release generate-release-pr
```

Projects are grouped by `release_group` in the configuration. Projects in the same group are released together in a single PR.

**PR Structure:**

- **Branch**: `release/<group-name>` (e.g., `release/frontend`)
- **Title**: `release: project-a@1.0.0, project-b@2.0.0` (lists all projects with versions)
- **Body**: Contains sections for each project's changelog

## `tag-release-commit`

Create git tags and releases for version changes:

```bash
# Preview what would be tagged
auto-release tag-release-commit --dry-run

# Create tags and releases
auto-release tag-release-commit
```

Compares HEAD with HEAD^1 to detect version changes. Creates tags in format `project-name@version`.

## `manual-release`

Create a manual release using existing change files:

```bash
auto-release manual-release
```

Useful for local testing or emergency releases.

## `apply-prerelease`

Apply a **pre-release** version (`<base>-<channel>.<id>`) to component files in place, for a
build/publish step. This is for publishing throwaway builds (`preview`) and release
candidates (`rc`/`alpha`/`beta`) - it does **not** touch change files, the changelog, git,
or open a PR. It only rewrites the version in the working tree so the next build picks it
up; the stable release flow is unchanged.

```bash
# Preview build from a feature branch (id = commit sha)
auto-release apply-prerelease --channel preview --id "$(git rev-parse --short HEAD)"

# Release candidate from the release branch (id = your build number / counter)
auto-release apply-prerelease --channel rc --id 3

# A single project in a monorepo, or a preview of the change
auto-release apply-prerelease --channel rc --id 3 --project my-app
auto-release apply-prerelease --channel rc --id 3 --dry-run
```

**Both `--channel` and `--id` are required** - the tool never invents the identifier, so you
compose it from whatever source you like (commit SHA, CI run number, registry lookup, …).

**Version computation** (works with any versioning strategy):

- The base `X.Y.Z` is the next stable version your pending change files would produce
  (`bump(current, changes)`) when change files are present - e.g. on a feature branch.
- When there are no pending change files - e.g. on the release branch, where
  `generate-release-pr` already bumped the version - the base is the current version as-is.
- The result is `<base>-<channel>.<id>`, e.g. `1.2.3-preview.a1b2c3d` or `1.2.3-rc.3`.

Typically run in a build/publish workflow, then publish under a matching dist-tag
(e.g. `npm publish --tag rc`). See [Recommended Usage](./recommended-usage.md).

## `generate-skill`

Generate an Agent Skill that teaches AI agents how to record change files for **this** repository:

```bash
auto-release generate-skill ./.claude/skills
```

The target directory is passed as a positional argument. Two files are written to an
`auto-release/` subfolder inside it (per the Claude Code convention that each skill lives in its
own folder):

```
.claude/skills/auto-release/
  SKILL.md                 generated in full, overwritten on every run
  change-file-format.md    yours - written once, never overwritten
```

`SKILL.md` is **project-aware**: it reads your config and embeds the real project names, the
valid change types for each project, and your `changes_dir`, so an agent gets concrete,
copy-pasteable `record-change` commands instead of placeholders.

`change-file-format.md` is where your repo's house style lives. It ships with an opinionated
default - imperative title, indented body paragraph, no change-type prefix (the changelog already
groups by type) - plus the underlying rule that content is copied into the changelog verbatim.
Edit it freely: `SKILL.md` points agents at it, and regenerating never touches it.

### Keeping it up to date

`SKILL.md` is derived from your config, so a config change (new project, new change types, moved
`changes_dir`) leaves it stale. Re-run the command to refresh it - your `change-file-format.md`
is left alone.

To catch staleness in CI, `--check` reports drift without writing anything, exiting non-zero if
the skill is missing, out of date, or has lost its `change-file-format.md`:

```bash
auto-release generate-skill --check ./.claude/skills
```

`auto-release check` runs the same validation automatically for skills in a conventional
location - `.claude/skills/`, `.agents/skills/`, or `skills/`, relative to your config folder or
git root. Anywhere else, wire `generate-skill --check <dir>` into CI explicitly.

Because `SKILL.md` is regenerated in full, edits to it are reported as drift and overwritten on
the next run - put anything you want to keep in `change-file-format.md`.

**Options:**

- `--check`: Report whether the skill is up to date instead of writing it. Exits non-zero on
  drift. Cannot be combined with `--force`.
- `--force`: Reset `change-file-format.md` back to the shipped default, discarding your edits.
