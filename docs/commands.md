# Commands

## `init`

Set up auto-release in your repository:

```bash
auto-release init
```

Interactively configures projects, versioning strategies, and git platform.

## `check`

Validate configuration and change files:

```bash
auto-release check
```

Use in CI to ensure everything is valid before merging.

## `record-change`

Create a new change file:

```bash
# Interactive
auto-release record-change

# Non-interactive
auto-release record-change --project my-app --type minor
```

## `list`

List all projects managed by `auto-release` with their current versions:

```bash
auto-release list
```

## `generate-release-pr`

Create or update release PRs:

```bash
# Preview changes
auto-release generate-release-pr --dry-run

# Create/update PRs
auto-release generate-release-pr

# Specific projects only
auto-release generate-release-pr --filter my-app --filter another-app
```

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
