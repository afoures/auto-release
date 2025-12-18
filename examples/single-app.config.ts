import { define_config } from "../dist/index.mjs";
import { semver } from "../dist/versioning.mjs";
import { github } from "../dist/git-providers.mjs";
import { node } from "../dist/components.mjs";

/**
 * Example configuration for a single-app repository
 */
export default define_config({
  apps: {
    "my-app": {
      components: [node("packages/my-app")],
      changelog: "CHANGELOG.md",
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
