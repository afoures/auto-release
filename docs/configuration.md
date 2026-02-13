# Configuration

## Projects

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

## Grouping Projects

Projects can be grouped to release together in a single pull/merge request using the `release_group` option.

### Default Behavior

By default, each project is its own group (releases individually). The group name defaults to the project name.

### Custom Groups

```typescript
export default define_config({
  projects: {
    "web-app": {
      release_group: "frontend",  // Groups with other "frontend" projects
      components: [...],
      versioning: semver(),
      changelog: "./CHANGELOG.md",
    },
    "mobile-app": {
      release_group: "frontend",  // Same group - released together
      components: [...],
      versioning: semver(),
      changelog: "./CHANGELOG.md",
    },
    "api": {
      // No release_group - defaults to "api" (individual release)
      components: [...],
      versioning: semver(),
      changelog: "./CHANGELOG.md",
    },
  },
});
```

**Resulting behavior:**

- Changes to `web-app` or `mobile-app` create a single PR with both projects
- Changes to `api` create an individual PR
- Branch name: `release/frontend` for grouped, `release/api` for individual
- PR title: `release: web-app@1.2.0, mobile-app@2.0.0` for grouped

### Default Project Config

Set default options for all projects:

```typescript
export default define_config({
  default_project_config: {
    release_group: "shared",  // All projects default to this group
    options: {
      skip_release_if_no_change_file: true,
    },
  },
  projects: { ... },
});
```

### Options

#### `skip_release_if_no_change_file`

When `true`, skip creating a release PR for projects without change files.

```typescript
projects: {
  "my-app": {
    components: [...],
    versioning: semver(),
    changelog: "CHANGELOG.md",
    options: {
      skip_release_if_no_change_file: true,
    },
  },
}
```

Useful for grouped projects where some projects may not have changes in every release cycle.

## Versioning Strategies

```typescript
import { semver, calver, markver } from 'auto-release/versioning'

// Semantic versioning: 1.2.3
versioning: semver()  // Change types: major, minor, patch

// Calendar versioning: 2025.1.2
versioning: calver()  // Change types: feature, fix

// Marketing versioning: 1.0.0
versioning: markver()  // Change types: marketing, feature, fix
```

## Git Platforms

### GitHub

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

### GitLab

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

## Tag Generator

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

## Components

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
