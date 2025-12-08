import { define_config, default_changelog_formatter } from "../src/index.js";
import { semver } from "../src/lib/versioning/semantic.js";
import { github } from "../src/lib/providers/github.js";
import { calver } from "../src/lib/versioning/calendar.js";
import { node } from "../src/lib/components/node.js";

/**
 * Example configuration for a monorepo with multiple apps
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
    "web-app": {
      components: [node("packages/web"), node("packages/shared")],
      changelog: "apps/web/CHANGELOG.md",
      versioning: calver({
        formatter: default_changelog_formatter({
          kind_map: {
            feature: "Feature",
            fix: "Bug Fix",
          },
        }),
      }),
    },
    "mobile-app": {
      components: [node("packages/mobile"), node("packages/shared")],
      changelog: "apps/mobile/CHANGELOG.md",
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
