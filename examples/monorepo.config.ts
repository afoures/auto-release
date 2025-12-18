import { define_config } from "../dist/index.mjs";
import { semver, calver } from "../dist/versioning.mjs";
import { github } from "../dist/git-providers.mjs";
import { node } from "../dist/components.mjs";

/**
 * Example configuration for a monorepo with multiple apps
 */
export default define_config({
  apps: {
    "web-app": {
      components: [node("packages/web"), node("packages/shared")],
      changelog: "apps/web/CHANGELOG.md",
      versioning: calver(),
    },
    "mobile-app": {
      components: [node("packages/mobile"), node("packages/shared")],
      changelog: "apps/mobile/CHANGELOG.md",
      versioning: semver(),
    },
  },
  git: {
    platform: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
  },
});
