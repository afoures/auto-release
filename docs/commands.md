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

Generate an Agent Skill (`SKILL.md`) that teaches AI agents how to record change files for **this** repository:

```bash
# Writes <dir>/auto-release/SKILL.md
auto-release generate-skill ./.claude/skills
```

The skill is **project-aware** - it reads your config and embeds the real project names, the
valid change types for each project, and your `changes_dir`, so an agent gets concrete,
copy-pasteable `record-change` commands instead of placeholders.

The target directory is passed as a positional argument (the skill is written to a
`auto-release/` subfolder inside it, per the Claude Code convention that each skill lives in
its own folder). `--output/-o` is accepted as an alias.

**Options:**

- `--force`: Overwrite an existing `SKILL.md` (by default the command errors if one is
  already present).

The generated file includes an editable **Change file format** section: it ships with a
neutral default (change content is copied into the changelog verbatim; a single bullet, a
bullet with an indented body, or plain prose are all valid - no leading `- ` is required).
Edit that section in place to describe your repo's preferred house style, and agents using
the skill will follow it.
