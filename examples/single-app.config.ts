import { define_config, default_changelog_formatter } from "../src/index.js";
import { semver } from "../src/lib/versioning/semantic.js";
import { github } from "../src/lib/providers/github.js";
import { node } from "../src/lib/components/node.js";

/**
 * Example configuration for a single-app repository
 */
export default define_config({
  changes_dir: ".changes",
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
    default_target_branch: "main",
  },
  apps: {
    "my-app": {
      components: [node("packages/my-app")],
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
});
