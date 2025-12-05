import { define_config } from "../src/index.js";
import { semver } from "../src/semantic-versioning.js";
import { github } from "../src/github-provider.js";
import { calver } from "../src/calendar-versioning.js";
import { default_changelog_formatter } from "../src/lib/formatter.js";

/**
 * Example configuration for a monorepo with multiple packages
 */
export default define_config({
  changes_dir: ".changes",
  apps: {
    "web-app": {
      packages: ["packages/web", "packages/shared"],
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
      packages: ["packages/mobile", "packages/shared"],
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
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
  },
});
