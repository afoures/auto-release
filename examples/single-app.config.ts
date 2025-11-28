import { define_config } from "../src/index.js";
import { semver } from "../src/semantic-versioning.js";
import { github } from "../src/github-provider.js";

/**
 * Example configuration for a single-app repository
 */
export default define_config({
  apps: [
    {
      name: "my-app",
      packages: ["packages/my-app"],
      versioning: semver(),
      changelog: {
        path: "CHANGELOG.md",
      },
      deploy: {
        command: "npm publish",
      },
    },
  ],
  changes_dir: ".changes",
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
    tag_template: "v${version}",
  },
});
