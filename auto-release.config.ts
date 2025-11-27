import { define_config } from "./dist/index.mjs";
import { semver } from "./dist/versioning/semver.mjs";

/**
 * Example configuration for the auto-release package itself
 *
 * To use this as your actual config, rename to auto-release.config.ts
 */
export default define_config({
  apps: [
    {
      name: "auto-release",
      packages: ["."],
      versioning: semver(),
      changelog: {
        path: "CHANGELOG.md",
      },
      deploy: {
        command: "pnpm publish --access public",
      },
    },
  ],
  changes_dir: ".changes",
  default_changelog_dir: "changelogs",
  git: {
    tag_template: "v${version}",
  },
});
