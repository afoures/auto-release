import { define_config } from "../src/index.js";
import { semver } from "../src/lib/versioning/semantic.js";
import { github } from "../src/lib/providers/github.js";
import { node } from "../src/lib/components/node.js";

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
