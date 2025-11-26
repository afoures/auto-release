import { define_config } from '../src/index.js'

/**
 * Example configuration for a monorepo with multiple packages
 */
export default define_config({
  apps: [
    {
      name: 'web-app',
      packages: ['packages/web', 'packages/shared'],
      versioning: {
        strategy: 'semver',
        change_types: ['major', 'minor', 'patch', 'none'],
      },
      changelog: {
        path: 'apps/web/CHANGELOG.md',
      },
      deploy: {
        command: 'pnpm --filter web deploy',
      },
    },
    {
      name: 'mobile-app',
      packages: ['packages/mobile', 'packages/shared'],
      versioning: {
        strategy: 'semver',
        change_types: ['major', 'minor', 'patch', 'none'],
      },
      changelog: {
        path: 'apps/mobile/CHANGELOG.md',
      },
      deploy: {
        command: 'pnpm --filter mobile build && fastlane deploy',
      },
    },
  ],
  changes_dir: '.changes',
  default_changelog_dir: 'changelogs',
  git: {
    tag_template: '${appName}@${version}',
  },
})
