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

export default define_config({
  apps: [
    {
      name: 'my-app',
      packages: ['packages/my-app'],
      versioning: {
        strategy: 'semver',
        change_types: ['major', 'minor', 'patch', 'none'],
      },
    },
  ],
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

export default define_config({
  // Required: List of apps to manage
  apps: [
    {
      // App name (used in change file paths and tags)
      name: 'web-app',
      
      // Packages belonging to this app (folders with package.json)
      packages: ['packages/web', 'packages/shared'],
      
      // Versioning configuration
      versioning: {
        strategy: 'semver', // or 'calver', or a custom strategy
        change_types: ['major', 'minor', 'patch', 'none'],
      },
      
      // Required: Changelog configuration
      changelog: {
        path: 'apps/web/CHANGELOG.md',
      },
      
      // Optional: Deployment configuration
      deploy: {
        command: 'pnpm --filter web deploy', // shell command to run
        // OR
        handler: async (context) => {
          // Custom deployment logic
          await context.exec('docker build...')
        },
      },
    },
  ],
  
  // Optional: Directory for change files (default: '.changes')
  changes_dir: '.changes',
  
  // Optional: Custom version strategies
  version_strategies: {
    custom: my_custom_strategy,
  },
  
  // Optional: Git configuration
  git: {
    // Tag format is always app_name@version (not customizable)
  },
})
```

### Apps Configuration

Each app in the `apps` array represents a releasable unit:

- **`name`**: Unique identifier for the app
- **`packages`**: Array of folder paths containing `package.json` files
  - All packages must have the same version
  - Versions will be updated together on release
- **`versioning`**: Version strategy and allowed change types
- **`changelog`**: Required changelog configuration with path
- **`deploy`**: Optional deployment configuration

### Versioning Strategies

#### Semver Strategy

Standard semantic versioning (X.Y.Z):

```typescript
{
  versioning: {
    strategy: 'semver',
    change_types: ['major', 'minor', 'patch', 'none'],
  },
}
```

- `major`: Breaking changes (X.0.0)
- `minor`: New features (0.Y.0)
- `patch`: Bug fixes (0.0.Z)
- `none`: Documentation/internal changes (no version bump)

When multiple changes exist, the highest precedence wins (major > minor > patch > none).

#### Calver Strategy

Calendar versioning (YYYY.MM.micro):

```typescript
import { calver_strategy } from 'auto-release'

{
  versioning: {
    strategy: calver_strategy,
    change_types: ['feature', 'fix', 'none'],
  },
}
```

- Format: `YYYY.MM.micro` (e.g., `2025.11.0`)
- Year and month from current date
- `micro` increments within the same month, resets on new month
- All changes bump the version; types are for grouping only

#### Custom Strategy

Define your own versioning logic:

```typescript
import { define_config, type VersionStrategy } from 'auto-release'

const custom_strategy: VersionStrategy = {
  id: 'custom',
  change_types: ['breaking', 'feature', 'fix'],
  
  parse(version: string) {
    const [major, minor] = version.split('.')
    return { major: parseInt(major), minor: parseInt(minor) }
  },
  
  format(parsed: any) {
    return `${parsed.major}.${parsed.minor}`
  },
  
  bump({ current_version, changes, now }) {
    const parsed = this.parse(current_version)
    // Your custom bump logic
    return this.format(parsed)
  },
}

export default define_config({
  apps: [
    {
      name: 'my-app',
      packages: ['packages/app'],
      versioning: {
        strategy: custom_strategy,
        change_types: ['breaking', 'feature', 'fix'],
      },
    },
  ],
})
```

## Change Files

Change files are stored in `.changes/<appName>/` with the format:

```
<type>.<slug>.md
```

Example: `major.add-authentication.md`, `patch.fix-login-bug.md`

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

### Change File Format

**Simple format** (title only):

```markdown
Fix authentication bug in login flow
```

**Detailed format** (with heading and body):

```markdown
# Add user profile page

This adds a comprehensive user profile page with the following features:

- Avatar upload and management
- Bio and social links
- Privacy settings
```

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
1. Computes next versions using version strategies
2. Updates `version` field in all app's `package.json` files
3. Appends new section to changelog
4. Deletes consumed change files

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
1. Reads current version from packages
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

### Deploy Configuration

#### Command-based

```typescript
{
  deploy: {
    command: 'npm publish',
  },
}
```

#### Handler-based

```typescript
{
  deploy: {
    handler: async (context) => {
      const { app, current_version, packages, logger, exec } = context
      
      logger.info(`Deploying ${app.name}@${current_version}`)
      
      // Build
      await exec('pnpm build')
      
      // Upload to S3
      await exec(`aws s3 sync dist/ s3://my-bucket/${current_version}/`)
      
      logger.success('Deployment complete')
    },
  },
}
```

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

## TypeScript API

You can also use `auto-release` programmatically:

```typescript
import { load_config } from 'auto-release'

const config = await load_config()
// Use config to build custom workflows
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
