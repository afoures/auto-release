# auto-release

A release management tool inspired by Changesets and Release Please, designed for monorepos with project-centric versioning.

## Why auto-release?

Release management should be simple. `auto-release` lets you focus on building features while it handles versioning, changelogs, and releases.

**Language agnostic**: Works with any project type. Built-in components for Node, Bun, Expo, and PHP projects, but you can add custom components for anything.

**Built for monorepos**: Each project can have its own versioning strategy (semver, calver, marketing) and release independently.

**Developer-friendly**: Record changes with markdown files as you work. No complex conventions or strict commit messages required.

**CI-native**: Release branches let you test before production. Tags trigger deployments automatically.

## Quick Start

```bash
npx --package=@afoures/auto-release@latest auto-release init
# or
pnpx --package=@afoures/auto-release@latest auto-release init
# or
bunx --package=@afoures/auto-release@latest auto-release init
```

This creates `auto-release.config.ts` and sets up the `.changes` directory.

### Manual Installation

```bash
npm install auto-release
# or
pnpm add auto-release
```

Create `auto-release.config.ts`:

```typescript
import { define_config } from 'auto-release'
import { semver } from 'auto-release/versioning'
import { github } from 'auto-release/providers'
import { node } from 'auto-release/components'

export default define_config({
  git: {
    platform: github({
      token: process.env.GITHUB_TOKEN!,
      owner: 'your-org',
      repo: 'your-repo',
    }),
    target_branch: 'main',
  },
  project: {
    'my-app': {
      components: [node('packages/my-app')],
      versioning: semver(),
      changelog: 'CHANGELOG.md',
    },
  },
})
```

## Workflow

### 1. Development

Make changes and record them:

```bash
auto-release record-change
```

Commit everything including the change file:

```bash
git add .
git commit -m "feat: add new feature"
git push
```

### 2. Generate Release PR

On `main` branch, CI should automatically run:

```bash
auto-release generate-release-pr
```

This creates/updates a release branch with:

- Updated versions in component files
- Generated changelog entries
- Change files removed

### 3. Test on Release Branch

CI on release branch runs:

- Tests and quality checks
- Build and deploy to test/staging environment

### 4. Merge Release PR

When ready, merge the release PR to `main`.

### 5. Tag and Deploy

CI on `main` runs:

```bash
auto-release tag-release-commit
```

This creates git tags for all releases, which can trigger deployment to pre-production and production.

## Commands

### `init`

Set up auto-release in your repository:

```bash
auto-release init
```

Interactively configures projects, versioning strategies, and git platform.

### `check`

Validate configuration and change files:

```bash
auto-release check
```

Use in CI to ensure everything is valid before merging.

### `record-change`

Create a new change file:

```bash
# Interactive
auto-release record-change

# Non-interactive
auto-release record-change --project my-app --type minor
```

### `list`

List all projects managed by `auto-release` with their current versions:

```bash
auto-release list
```

### `generate-release-pr`

Create or update release PRs:

```bash
# Preview changes
auto-release generate-release-pr --dry-run

# Create/update PRs
auto-release generate-release-pr

# Specific projects only
auto-release generate-release-pr --filter my-app --filter another-app
```

### `tag-release-commit`

Create git tags and releases for version changes:

```bash
# Preview what would be tagged
auto-release tag-release-commit --dry-run

# Create tags and releases
auto-release tag-release-commit
```

Compares HEAD with HEAD^1 to detect version changes. Creates tags in format `project-name@version`.

### `manual-release`

Create a manual release using existing change files:

```bash
auto-release manual-release
```

Useful for local testing or emergency releases.

## Configuration

### Projects

The `projects` object defines each releasable unit:

```typescript
projects: {
  'my-app': {
    // Components: where versions are read/written
    components: [
      node('packages/my-app'),
      node('packages/shared'),
    ],

    // Versioning strategy
    versioning: semver(),

    // Changelog file path
    changelog: 'apps/my-app/CHANGELOG.md',
  },
}
```

### Versioning Strategies

```typescript
import { semver, calver, markver } from 'auto-release/versioning'

// Semantic versioning: 1.2.3
versioning: semver()  // Change types: major, minor, patch

// Calendar versioning: 2025.1.2
versioning: calver()  // Change types: feature, fix

// Marketing versioning: 1.0.0
versioning: markver()  // Change types: marketing, feature, fix
```

### Git Platforms

#### GitHub

```typescript
import { github } from 'auto-release/providers'

git: {
  platform: github({
    token: process.env.GITHUB_TOKEN!,
    owner: 'your-org',
    repo: 'your-repo',
  }),
  target_branch: 'main',
  tag_generator: ({ project, version }) => `${project.name}-${version}`,
}
```

#### GitLab

```typescript
import { gitlab } from 'auto-release/providers'

git: {
  platform: gitlab({
    token: process.env.GITLAB_TOKEN!,
    project_id: 'your-project-id',
  }),
  target_branch: 'main',
}
```

### Tag Generator

Customize the format of git tags created during release:

```typescript
git: {
  // ... other options
  tag_generator: ({ project, version }) => `${project.name}-${version}`,
}
```

**Default**: `project-name@version` (e.g., `my-app@1.2.3`)

**Custom examples**:

```typescript
// Version only: 1.2.3
tag_generator: ({ version }) => `${version}`

// Prefixed: v1.2.3
tag_generator: ({ version }) => `v${version}`

// With prefix: release/my-app-1.2.3
tag_generator: ({ project, version }) => `release/${project.name}-${version}`
```

### Components

Components define version sources:

- **`node(path)`**: any node project with package.json
- **`bun(path)`**: any bun project with package.json
- **`expo(path)`**: any Expo project with package.json and app.json
- **`php(path)`**: any PHP project with composer.json

```typescript
import { node, expo, php } from 'auto-release/components'

components: [
  node('packages/web'),
  bun('packages/bff'),
  expo('apps/mobile'),
  php('packages/api'),
]
```

## Change Files

Change files are stored in `.changes/<project-name>/` with format:

```
<type>.<slug>.md
```

Examples:

- `.changes/my-app/major.add-authentication.md`
- `.changes/my-app/patch.fix-login-bug.md`

The change files folder can be customized.

### Format

**Simple** (title only):

```markdown
Fix authentication bug in login flow
```

**Detailed** (with description):

```markdown
This adds a comprehensive user profile page with:
- Avatar upload
- Bio and social links
- Privacy settings
```

## Philosophy

Inspired by Changesets and Release Please, designed for project-centric monorepos where:

- Multiple projects release independently with different versioning strategies
- Change files are organized by project for clarity
- Release branches allow testing before production
- Deployment is integrated with the release process

## License

MIT

See [LICENSE](./LICENSE)
