import { define_config, type VersioningStrategy } from "../src/index.js";
import { github } from "../src/github-provider.js";

/**
 * Custom versioning strategy factory example
 */
function custom_version(): VersioningStrategy {
  return {
    change_types: ["breaking", "feature", "fix"],

    bump({ current_version, changes }) {
      const [major_str, minor_str] = current_version.split(".");
      const parsed = {
        major: parseInt(major_str, 10),
        minor: parseInt(minor_str, 10),
      };

      const has_breaking = changes.some((c) => c.type === "breaking");
      const has_feature = changes.some((c) => c.type === "feature");

      if (has_breaking) {
        parsed.major++;
        parsed.minor = 0;
      } else if (has_feature) {
        parsed.minor++;
      }

      return `${parsed.major}.${parsed.minor}`;
    },
  };
}

/**
 * Example configuration with custom strategy
 */
export default define_config({
  changes_dir: ".changes",
  apps: [
    {
      name: "custom-app",
      packages: ["packages/custom"],
      versioning: custom_version(),
      changelog: "CHANGELOG.md",
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
