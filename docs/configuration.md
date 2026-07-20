# Configuration

## Projects

The `projects` object defines each releasable unit:

```typescript
projects: {
  "my-app": {
    // Components: where versions are read/written
    components: [
      node("packages/my-app"),
      node("packages/shared"),
    ],

    // Versioning strategy
    versioning: semver(),

    // Changelog file path
    changelog: "apps/my-app/CHANGELOG.md",
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
import { semver, calver, markver } from "@afoures/auto-release/versioning"

// Semantic versioning: 1.2.3
versioning: semver()  // Change types: major, minor, patch

// Calendar versioning: 2025.1.2
versioning: calver()  // Change types: feature, fix

// Marketing versioning: 1.0.0
versioning: markver()  // Change types: marketing, feature, fix
```

### Pre-1.0 (`unstable`)

While a project is still in `0.x`, breaking changes are expected, so promoting to `1.0.0`
on the first one is usually premature. Set `unstable: true` to follow the classic `0.x`
convention where breaking changes are non-promoting:

```typescript
versioning: semver({ unstable: true })
```

While on a `0.x` version, a breaking change (`major`) bumps the **minor** instead of
graduating to `1.0.0`. Features (`minor`) and fixes (`patch`) are unchanged. For example,
from `0.5.2`:

| change             | `semver({ unstable: true })` | `semver()` (default) |
| ------------------ | ---------------------------- | -------------------- |
| breaking (`major`) | `0.6.0`                      | `1.0.0`              |
| feature (`minor`)  | `0.6.0`                      | `0.6.0`              |
| fix (`patch`)      | `0.5.3`                      | `0.5.3`              |

**Graduating to `1.0.0`:** when you're ready to commit to a stable API, remove
`unstable: true`. This reverts to standard semantic versioning, so the next release that
contains a breaking change takes `0.x` to `1.0.0`. The breaking change is what triggers
the graduation - feature/fix-only releases after removing the flag stay in `0.x`.

`unstable` has no effect once the version is already `>= 1.0.0`.

## Git Platforms

### GitHub

```typescript
import { github } from "@afoures/auto-release/providers"

git: {
  platform: github({
    token: process.env.GITHUB_TOKEN!,
    owner: "your-org",
    repo: "your-repo",
  }),
  target_branch: "main",
  tag_generator: ({ project, version }) => `${project.name}-${version}`,
}
```

### GitLab

```typescript
import { gitlab } from "@afoures/auto-release/providers"

git: {
  platform: gitlab({
    token: process.env.GITLAB_TOKEN!,
    project_id: "your-project-id",
  }),
  target_branch: "main",
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
import { node, expo, php } from "@afoures/auto-release/components"

components: [
  node("packages/web"),
  bun("packages/bff"),
  expo("apps/mobile"),
  php("packages/api"),
]
```
