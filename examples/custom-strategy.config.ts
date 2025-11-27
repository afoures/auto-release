import { define_config, type VersionStrategy } from "../src/index.js";

/**
 * Custom versioning strategy factory example
 */
function custom_version(): VersionStrategy {
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
  apps: [
    {
      name: "custom-app",
      packages: ["packages/custom"],
      versioning: custom_version(),
    },
  ],
  changes_dir: ".changes",
});
