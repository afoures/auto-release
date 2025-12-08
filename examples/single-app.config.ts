import { define_config } from "../src/index.js";
import { semver } from "../src/versioning.js";
import { github } from "../src/git-providers.js";
import { node } from "../src/components.js";

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
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
  },
});
