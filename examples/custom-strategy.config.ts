import {
  define_config,
  VersionManager,
  Formatter,
  ChangeKindDisplayMap,
} from "../src/index.js";
import { github } from "../src/git-providers.js";
import { node } from "../src/components.js";

type AllowedChangeKind = "breaking" | "feature" | "fix";
/**
 * Custom versioning strategy factory example
 */
function custom_version(): VersionManager<AllowedChangeKind> {
  const allowed_changes = ["breaking", "feature", "fix"] as const;
  return {
    allowed_changes,
    formatter: {} as Formatter<AllowedChangeKind, any>,
    display_map: {} as ChangeKindDisplayMap<AllowedChangeKind>,
    compare(version_a, version_b) {
      const a = version_a.split(".");
      const b = version_b.split(".");
      if (a[0] !== b[0]) return a[0] > b[0] ? 1 : -1;
      if (a[1] !== b[1]) return a[1] > b[1] ? 1 : -1;
      return 0;
    },
    validate({ version }) {
      return true;
    },
    bump({ version, changes, date }) {
      // Return current version if no changes
      if (changes.length === 0) {
        return version;
      }

      const [major_str, minor_str] = version.split(".");
      const parsed = {
        major: parseInt(major_str, 10),
        minor: parseInt(minor_str, 10),
      };

      const has_breaking = changes.some((c) => c.kind === "breaking");
      const has_feature = changes.some((c) => c.kind === "feature");

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
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
    default_target_branch: "main",
  },
  apps: {
    "custom-app": {
      components: [node("packages/custom")],
      changelog: "CHANGELOG.md",
      versioning: custom_version(),
    },
  },
});
