import { define_config } from "../src/index.js";
import { semver } from "../src/semantic-versioning.js";
import { github } from "../src/github-provider.js";
import { default_changelog_formatter } from "../src/lib/formatter.js";

/**
 * Example configuration for a single-app repository
 */
export default define_config({
  changes_dir: ".changes",
  apps: {
    "my-app": {
      packages: ["packages/my-app"],
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
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
  },
});
