import { define_config } from "../src/index.js";
import { semver } from "../src/semantic-versioning.js";
import { github } from "../src/github-provider.js";

/**
 * Example configuration for a monorepo with multiple packages
 */
export default define_config({
  apps: [
    {
      name: "web-app",
      packages: ["packages/web", "packages/shared"],
      versioning: semver(),
      changelog: {
        path: "apps/web/CHANGELOG.md",
      },
      deploy: {
        command: "pnpm --filter web deploy",
      },
    },
    {
      name: "mobile-app",
      packages: ["packages/mobile", "packages/shared"],
      versioning: semver(),
      changelog: {
        path: "apps/mobile/CHANGELOG.md",
      },
      deploy: {
        command: "pnpm --filter mobile build && fastlane deploy",
      },
    },
  ],
  changes_dir: ".changes",
  git: github({
    token: process.env.GITHUB_TOKEN!,
    owner: process.env.GITHUB_OWNER!,
    repo: process.env.GITHUB_REPO!,
  }),
});
