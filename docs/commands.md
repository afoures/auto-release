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

# Fully non-interactive — one shot, no editor (for scripts and agents)
auto-release record-change --project my-app --type minor --slug dark-theme-toggle \
  --content $'Add dark mode\n\nUsers can now toggle a dark theme from settings.'
```

**Options:**

- `--project <name>`: Project name (optional if only one project is managed).
- `--type <type>`: Change type (e.g. `minor`, `patch`). Must be valid for the project.
- `--content <text>`: Change content — the first line is the title, anything after is
  the body. When provided, the content is written directly and **the editor is skipped**,
  so the command runs to completion without any interaction.
- `--slug <slug>`: Explicit slug for the change filename. Defaults to a slug derived from
  the content title (or the description you type in interactive mode).

**Non-interactive behavior:** when stdin is not a TTY (or the command runs in CI), the
interactive prompts are disabled. If a required value is missing the command exits with a
clear error rather than hanging — for example, omitting `--type` prints
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
