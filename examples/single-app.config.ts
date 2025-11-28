import { define_config } from "../src/index.js";
import { semver } from "../src/versioning/semver.js";

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
    tag_template: "v${version}",
  },
});
