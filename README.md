# auto-release

A release management tool inspired by Changesets and Release Please, designed for monorepos with project-centric versioning.

## Why auto-release?

Release management should be simple. `auto-release` lets you focus on building features while it handles versioning, changelogs, and releases.

**Language agnostic**: Works with any project type. Built-in components for Node, Bun, Expo, and PHP projects, but you can add custom components for anything.

**Built for monorepos**: Each project can have its own versioning strategy (semver, calver, marketing) and release independently.

**Developer-friendly**: Record changes with markdown files as you work. No complex conventions or strict commit messages required.

**CI-native**: Release branches let you test before production. Tags trigger deployments automatically.

**Pre-release builds**: Publish `preview`/`rc`/`alpha`/`beta` builds from anywhere without disturbing the stable release flow.

## Quick Start

```bash
npx @afoures/auto-release@latest init
# or
pnpm dlx @afoures/auto-release@latest init
# or
yarn dlx @afoures/auto-release@latest init
# or
bunx @afoures/auto-release@latest init
```

This creates `auto-release.config.ts` and sets up the `.changes` directory.

### Manual Installation

```bash
npm install @afoures/auto-release
# or
pnpm add @afoures/auto-release
# or
yarn add @afoures/auto-release
# or
bunx add @afoures/auto-release
```

Create `auto-release.config.ts`:

```typescript
import { define_config } from "@afoures/auto-release";
import { semver } from "@afoures/auto-release/versioning";
import { github } from "@afoures/auto-release/providers";
import { node } from "@afoures/auto-release/components";

export default define_config({
  projects: {
    "my-app": {
      components: [node("packages/my-app")],
      versioning: semver(),
      changelog: "CHANGELOG.md",
    },
  },
  git: {
    platform: github({
      token: process.env.GITHUB_TOKEN!,
      owner: "your-org",
      repo: "your-repo",
    }),
    target_branch: "main",
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
