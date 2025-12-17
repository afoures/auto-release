# auto-release

A Changesets-inspired release management tool for monorepos with app-centric versioning.

## Features

- 🎯 **App-centric**: Manage multiple apps with independent versioning in a monorepo
- 📦 **Multi-package support**: Apps can span multiple `package.json` files
- 🔄 **Flexible versioning**: Built-in semver and calver strategies, plus custom strategies
- 📝 **Human-friendly changesets**: Markdown change files with validation
- 📋 **Automated changelogs**: Generate formatted changelogs per app
- 🚀 **Deployment integration**: Run commands or custom handlers with git tagging
- ✅ **CI-friendly**: Validation, dry-run modes, and JSON output

## Requirements

- Node.js >= 22.0.0

## Installation

```bash
npm install auto-release
# or
pnpm add auto-release
# or
yarn add auto-release
```

## Quick Start

1. Run the interactive setup:

   ```bash
   npx auto-release init
   # or
   pnpm auto-release init
   ```

   This creates `auto-release.config.ts`, bootstraps the `.changes` directory, and installs the dependency. Prefer manual setup? Create `auto-release.config.ts` yourself:

```typescript
import { define_config } from 'auto-release'
import { semver } from 'auto-release/versioning'
import { github } from 'auto-release/providers'
import { node } from 'auto-release/components'

export default define_config({
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: 'your-org',
      repo: 'your-repo',
    }),
    default_target_branch: 'main',
  },
  apps: {
    'my-app': {
      components: [node('packages/my-app')],
      versioning: semver(),
      changelog: 'CHANGELOG.md',
    },
  },
})
```

2. Create a change file:

```bash
auto-release record
```

3. Preview what would be released (dry-run):

```bash
auto-release generate-release --dry-run
```

4. Prepare release PRs:

```bash
auto-release release
```

5. Deploy and tag:

```bash
auto-release deploy
```

## Configuration

### Config File Format

Create `auto-release.config.ts` at your repository root:

```typescript
import { define_config } from 'auto-release'
import { semver, calver } from 'auto-release/versioning'
import { github } from 'auto-release/providers'
import { node } from 'auto-release/components'

export default define_config({
  // Required: Git provider configuration
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: 'your-org',
      repo: 'your-repo',
    }),
    // Optional: Default target branch for PRs and releases (default: 'main')
    default_target_branch: 'main',
    // Optional: Release branch prefix (default: 'release')
    default_release_branch_prefix: 'release',
  },

  // Required: Apps record (object keyed by app name)
  apps: {
    'web-app': {
      // Components that define version sources (e.g., package.json files)
      components: [
        node('packages/web'),
        node('packages/shared'),
      ],

      // Versioning strategy with optional formatter
      versioning: semver({
        // Optional: Custom formatter for changelog/release notes
        formatter: default_changelog_formatter({
          kind_map: {
            major: 'Major Changes',
            minor: 'Minor Changes',
            patch: 'Patch Changes',
          },
        }),
      }),

      // Required: Changelog file path (relative to repo root)
      changelog: 'apps/web/CHANGELOG.md',
    },
  },

  // Optional: Directory for change files (default: '.changes')
  changes_dir: '.changes',
})
```

### Apps Configuration

The `apps` configuration is a **record** (object) keyed by app name. Each app represents a releasable unit:

- **App name** (key): Unique identifier used in change file paths and git tags
- **`components`**: Array of component functions that define version sources
  - Components like `node()` read/write versions from `package.json` files
  - All components must have the same version
  - Versions will be updated together on release
- **`versioning`**: Version manager (created via `semver()` or `calver()`)
  - Includes `allowed_changes` (change types) and `bump()` function
  - Optional `formatter` for custom changelog/release notes formatting
- **`changelog`**: Required string path to changelog file (relative to repo root)

### Versioning Strategies

Versioning strategies are created via factory functions (`semver()` or `calver()`) that return a `VersionManager` object.

#### Semver Strategy

Standard semantic versioning (X.Y.Z):

```typescript
import { semver } from 'auto-release/versioning'
import { default_changelog_formatter } from 'auto-release'

// With default formatter
versioning: semver()

// With custom formatter
versioning: semver({
  formatter: default_changelog_formatter({
    kind_map: {
      major: 'Major Changes',
      minor: 'Minor Changes',
      patch: 'Patch Changes',
    },
  }),
})
```

- **Allowed changes**: `['major', 'minor', 'patch']`
- `major`: Breaking changes (X.0.0)
- `minor`: New features (0.Y.0)
- `patch`: Bug fixes (0.0.Z)
- When multiple changes exist, the highest precedence wins (major > minor > patch)
- Returns current version if no changes provided

#### Calver Strategy

Calendar versioning (YYYY.MINOR.PATCH):

```typescript
import { calver } from 'auto-release/versioning'

// With default formatter
versioning: calver()

// With custom formatter
versioning: calver({
  formatter: default_changelog_formatter({
    kind_map: {
      feature: 'Features',
      fix: 'Bug Fixes',
    },
  }),
})
```

- **Allowed changes**: `['feature', 'fix']`
- Format: `YYYY.MINOR.PATCH` (e.g., `2025.1.2`)
- Year from current date
- `MINOR` increments for features, `PATCH` increments for fixes
- Resets to `YYYY.1.0` when year changes
- Returns current version if no changes provided

#### Formatters

Formatters control how changelogs and release notes are generated. The `default_changelog_formatter()` provides a simple default, but you can create custom formatters that implement the `Formatter` interface for full control over markdown parsing and generation.

## Change Files

Change files are stored in `.changes/<appName>/` with the format:

```
<kind>.<slug>.md
```

Example: `major.add-authentication.md`, `patch.fix-login-bug.md`

The `kind` must match one of the `allowed_changes` from your app's versioning strategy.

### Creating Change Files

#### Interactive Mode

```bash
auto-release record
```

Prompts you for:

- App selection
- Change type
- Summary
- Optional description

#### Non-Interactive Mode

```bash
auto-release record \
  --app web-app \
  --type minor \
  --summary "Add dark mode support" \
  --description "Users can now toggle between light and dark themes"
```

Note: `--type` refers to the change `kind` (must be one of the versioning strategy's `allowed_changes`).

### Change File Format

**Simple format** (title only):

```markdown
Fix authentication bug in login flow
```

**Detailed format** (with heading and description):

```markdown
# Add user profile page

This adds a comprehensive user profile page with the following features:

- Avatar upload and management
- Bio and social links
- Privacy settings
```

The description (body) is parsed as an array of lines and can be used by formatters to generate rich changelog entries.

## Commands

### `init`

Interactively scaffold `auto-release` in a repository:

```bash
auto-release init
```

What it does:

- Detects or prompts for your package manager and installs `auto-release`
- Asks for apps, packages, changelog paths, and versioning strategies
- Configures GitHub or GitLab provider details
- Generates `auto-release.config.ts`, `.changes/`, and empty changelog files (one per app)

### `check`

Validate configuration, packages, and change files:

```bash
auto-release check
```

Options:

- `--config <path>`: Custom config file path
- `--json`: Output results as JSON

Validates:

- Config structure and schema
- All packages exist and versions match per app
- Change file naming and types
- Markdown parsing

Exit code: 0 if valid, 1 if errors found (CI-friendly).

### `record`

Record a new change:

```bash
# Interactive
auto-release record

# Non-interactive
auto-release record \
  --app my-app \
  --type minor \
  --summary "Add new feature"
```

Options:

- `--app <name>`: App name
- `--type <type>`: Change type
- `--summary <text>`: Change summary
- `--description <text>`: Detailed description
- `--config <path>`: Custom config file path

### `generate-release`

Create or update release PRs from change files:

```bash
# Create/update release PRs
auto-release generate-release

# Preview what would be released (dry-run)
auto-release generate-release --dry-run

# Specific app only
auto-release generate-release --app web-app
```

When using `--dry-run`, shows:

- Apps with pending changes
- Current → next version
- Release branch name
- Detailed list of changes with types, titles, and file paths

Options:

- `--app <name>`: Filter by app name
- `--dry-run`: Show what would be done without making changes
- `--config <path>`: Custom config file path

### `release`

Release apps with pending changes:

```bash
# Interactive (prompts for confirmation)
auto-release release

# With confirmation
auto-release release --yes

# Dry run (show plan without making changes)
auto-release release --dry-run

# Specific app only
auto-release release --app web-app
```

Actions performed:

1. Computes next versions using version strategies (`bump()` function)
2. Updates version in all app's component files (via component `update_version()`)
3. Generates changelog section using versioning formatter
4. Appends new section to changelog file
5. Deletes consumed change files

Options:

- `--app <name>`: Filter by app name
- `--dry-run`: Show plan without making changes
- `--yes`: Skip confirmation prompt
- `--config <path>`: Custom config file path

**Note**: This command does NOT create git commits or tags. Use `deploy` for that.

### `deploy`

Deploy apps and create git tags:

```bash
# Interactive (prompts for confirmation)
auto-release deploy

# With confirmation
auto-release deploy --yes

# Dry run
auto-release deploy --dry-run

# Specific app only
auto-release deploy --app web-app
```

Actions performed:

1. Reads current version from components
2. Runs deployment command/handler for each app
3. If ALL deployments succeed, creates git tags
4. If ANY deployment fails, no tags are created

Options:

- `--app <name>`: Filter by app name
- `--dry-run`: Show plan without executing
- `--yes`: Skip confirmation prompt
- `--config <path>`: Custom config file path

**Tag format**: Always uses `app_name@version` format (not customizable)

After successful deployment:

```bash
git push --tags
```

### Components

Components define where versions are read from and written to. Built-in components:

- **`node(path)`**: Reads/writes version from `package.json` at the given path
- **`expo(path)`**: Reads/writes version from `app.json` (Expo projects)
- **`php(path)`**: Reads/writes version from `composer.json` (PHP projects)

Components are functions that return an object with:

- `path`: Base path of the component
- `parts`: Array of parts, each with:
  - `path`: File path
  - `get_current_version()`: Function to read current version
  - `update_version(version)`: Function to write new version

You can create custom components by implementing the `Component` interface.

## Workflows

### Typical Development Workflow

1. **Make changes** to your code

2. **Create change file**:

   ```bash
   auto-release record
   ```

3. **Commit everything** (including change file):

   ```bash
   git add .
   git commit -m "feat: add new feature"
   git push
   ```

4. **On main branch**, when ready to release:

   ```bash
   auto-release generate-release --dry-run  # Review what will be released
   auto-release generate-release  # Create/update release PRs
   ```

5. **Deploy** (usually in CI after release commit):
   ```bash
   auto-release deploy
   git push --tags
   ```

### Recommended CI Setup

#### GitHub Actions Example

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: actions/setup-node@v3
        with:
          node-version: 22

      - run: pnpm install

      # Validate on every push
      - run: pnpm auto-release check

      # Preview what would be released
      - run: pnpm auto-release generate-release --dry-run

      # Check if there are changes to release
      - id: check-changes
        run: |
          if pnpm auto-release generate-release --dry-run | grep -q "No pending changes"; then
            echo "has_changes=false" >> $GITHUB_OUTPUT
          else
            echo "has_changes=true" >> $GITHUB_OUTPUT
          fi

      # Release (update versions, changelogs)
      - if: steps.check-changes.outputs.has_changes == 'true'
        run: pnpm auto-release release --yes

      # Commit release changes
      - if: steps.check-changes.outputs.has_changes == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add .
          git commit -m "chore: release [skip ci]"
          git push

      # Deploy and tag
      - if: steps.check-changes.outputs.has_changes == 'true'
        run: pnpm auto-release deploy --yes
        env:
          # Add any deployment secrets here
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

      # Push tags
      - if: steps.check-changes.outputs.has_changes == 'true'
        run: git push --tags
```

## Examples

See the [`examples/`](./examples) directory for complete configuration examples:

- **[single-app.config.ts](./examples/single-app.config.ts)**: Single app repository
- **[monorepo.config.ts](./examples/monorepo.config.ts)**: Monorepo with multiple apps
- **[calver.config.ts](./examples/calver.config.ts)**: Calendar versioning
- **[custom-strategy.config.ts](./examples/custom-strategy.config.ts)**: Custom version strategy

## Philosophy

`auto-release` is inspired by Changesets but designed for app-centric monorepos where:

- Multiple apps share packages but release independently
- Each app can have its own versioning strategy
- Change files are organized by app for clarity
- Deployment is tightly integrated with versioning

Unlike traditional Changesets:

- **App-focused** rather than package-focused
- **Built-in deployment** support with git tagging
- **Flexible strategies** beyond semver
- **Simpler model** for multi-package apps

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
