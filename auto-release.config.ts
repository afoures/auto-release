import { define_config, default_changelog_formatter } from "./dist/index.mjs";
import { semver } from "./dist/semantic-versioning.mjs";
import { github } from "./dist/github-provider.mjs";
import { node } from "./dist/components.mjs";

/**
 * Example configuration for the auto-release package itself
 *
 * To use this as your actual config, rename to auto-release.config.ts
 */
export default define_config({
  changes_dir: ".changes",
  apps: {
    "auto-release": {
      components: [node(".")],
      changelog: "CHANGELOG.md",
      versioning: semver({
        formatter: default_changelog_formatter({
          kind_map: {
            major: "Breaking Changes",
            minor: "Features",
            patch: "Bug Fixes",
          },
        }),
      }),
    },
  },
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
    default_target_branch: "main",
    default_release_branch_prefix: "release",
  },
});
