import { define_config } from '../src/index.js'

/**
 * Example configuration for a single-app repository
 */
export default define_config({
  apps: [
    {
      name: 'my-app',
      packages: ['packages/my-app'],
      versioning: {
        strategy: 'semver',
        change_types: ['major', 'minor', 'patch', 'none'],
      },
      changelog: {
        path: 'CHANGELOG.md',
      },
      deploy: {
        command: 'npm publish',
      },
    },
  ],
  changes_dir: '.changes',
  default_changelog_dir: 'changelogs',
  git: {
    tag_template: 'v${version}',
  },
})
