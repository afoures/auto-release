import { define_config } from "../src/index.js";
import { semver } from "../src/semantic-versioning.js";
import { github } from "../src/github-provider.js";

/**
 * Example configuration for a monorepo with multiple packages
 */
export default define_config({
  changes_dir: ".changes",
  apps: [
    {
      name: "web-app",
      packages: ["packages/web", "packages/shared"],
      versioning: semver(),
      changelog: "apps/web/CHANGELOG.md",
    },
    {
      name: "mobile-app",
      packages: ["packages/mobile", "packages/shared"],
      versioning: semver(),
      changelog: "apps/mobile/CHANGELOG.md",
    },
  ],
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
  },
});
