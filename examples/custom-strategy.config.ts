import { define_config, type VersionStrategy } from "../src/index.js";

/**
 * Custom versioning strategy example
 */
const custom_strategy: VersionStrategy = {
  id: "custom",
  change_types: ["breaking", "feature", "fix"],

  parse(version: string) {
    const [major, minor] = version.split(".");
    return { major: parseInt(major, 10), minor: parseInt(minor, 10) };
  },

  format(parsed: any) {
    return `${parsed.major}.${parsed.minor}`;
  },

  bump({ current_version, changes }) {
    const parsed = this.parse(current_version);
    const has_breaking = changes.some((c) => c.type === "breaking");
    const has_feature = changes.some((c) => c.type === "feature");

    if (has_breaking) {
      parsed.major++;
      parsed.minor = 0;
    } else if (has_feature) {
      parsed.minor++;
    }

    return this.format(parsed);
  },
};

/**
 * Example configuration with custom strategy
 */
export default define_config({
  apps: [
    {
      name: "custom-app",
      packages: ["packages/custom"],
      versioning: {
        strategy: custom_strategy,
        change_types: ["breaking", "feature", "fix"],
      },
    },
  ],
  version_strategies: {
    custom: custom_strategy,
  },
  changes_dir: ".changes",
});
