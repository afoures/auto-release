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
  projects: {
    'my-app': {
      components: [node('packages/my-app')],
      versioning: semver(),
      changelog: 'CHANGELOG.md',
    },
  },
})
```

## Documentation

- [Configuration](./docs/configuration.md)
- [Recommended usage](./docs/recommended-usage.md)
- [Change File anatomy](./docs/change-file-anatomy.md)
- [Commands](./docs/commands.md)
- [Lexicon](./docs/lexicon.md)

## Philosophy

Inspired by Changesets and Release Please, designed for project-centric monorepos where:

- Multiple projects release independently with different versioning strategies
- Change files are organized by project for clarity
- Release branches allow testing before production
- Deployment is integrated with the release process

## License

MIT

See [LICENSE](./LICENSE)
