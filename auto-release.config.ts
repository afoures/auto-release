import { define_config, default_changelog_formatter } from "./dist/index.mjs";
import { semver } from "./dist/semantic-versioning.mjs";
import { github } from "./dist/github-provider.mjs";

/**
 * Example configuration for the auto-release package itself
 *
 * To use this as your actual config, rename to auto-release.config.ts
 */
export default define_config({
  apps: {
    "auto-release": {
      packages: ["."],
      changelog: "CHANGELOG.md",
      versioning: semver({
        formatter: default_changelog_formatter({
          kind_map: {
            major: "Major",
            minor: "Minor",
            patch: "Patch",
          },
        }),
      }),
    },
  },
  changes_dir: ".changes",
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
  },
});
