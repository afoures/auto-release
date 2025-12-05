import {
  define_config,
  default_changelog_formatter,
  VersionManager,
} from "../src/index.js";
import { github } from "../src/github-provider.js";
import { node } from "../src/components.js";

type AllowedChangeKind = "breaking" | "feature" | "fix";
/**
 * Custom versioning strategy factory example
 */
function custom_version(): VersionManager<AllowedChangeKind> {
  const allowed_changes = ["breaking", "feature", "fix"] as const;
  return {
    allowed_changes,
    formatter: default_changelog_formatter<AllowedChangeKind>({
      kind_map: {
        breaking: "Breaking Change",
        feature: "Feature",
        fix: "Bug Fix",
      },
    })(allowed_changes),
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
    bump({ version, changes }) {
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
  apps: {
    "custom-app": {
      components: [node("packages/custom")],
      changelog: "CHANGELOG.md",
      versioning: custom_version(),
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
