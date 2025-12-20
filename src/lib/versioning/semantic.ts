import { regex } from "arkregex";
import type { ChangeFile } from "../change-file.ts";
import type { ChangeKindDisplayMap, Formatter, VersionManager } from "./types.ts";
import { default_formatter } from "../formatter.ts";

interface SemanticVersion {
  major: bigint;
  minor: bigint;
  patch: bigint;
}

const SEMVER_REGEX = regex("^(?<major>\\d+).(?<minor>\\d+).(?<patch>\\d+)$");

function parse(version: string): SemanticVersion {
  const match = SEMVER_REGEX.exec(version);
  if (!match) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  return {
    major: BigInt(match.groups.major),
    minor: BigInt(match.groups.minor),
    patch: BigInt(match.groups.patch),
  };
}

function format(parsed: SemanticVersion): string {
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

type SemanticChangeKind = "major" | "minor" | "patch";

/**
 * Semantic versioning strategy factory
 *
 * Format: major.minor.patch (e.g., 1.0.0)
 */
export function semver<
  parsed_changelog extends {
    releases: Array<{
      version: string;
      changes: Array<ChangeFile<SemanticChangeKind>>;
    }>;
  },
>({
  formatter: custom_formatter,
  display_map: custom_display_map,
}:
  | {
      formatter: Formatter<SemanticChangeKind, parsed_changelog>;
      display_map?: ChangeKindDisplayMap<SemanticChangeKind>;
    }
  | {
      formatter?: never;
      display_map?: ChangeKindDisplayMap<SemanticChangeKind>;
    } = {}): VersionManager<SemanticChangeKind, any> {
  const allowed_changes = ["major", "minor", "patch"] as const;
  const display_map =
    custom_display_map ??
    ({
      major: { singular: "Breaking Change", plural: "Breaking Changes" },
      minor: { singular: "Feature", plural: "Features" },
      patch: { singular: "Bug Fix", plural: "Bug Fixes" },
    } satisfies ChangeKindDisplayMap<SemanticChangeKind>);
  const formatter = custom_formatter || default_formatter({ allowed_changes, display_map });

  return {
    allowed_changes,
    hotfix_allowed_changes: ["patch"] as const,
    initial_version: "0.0.0",
    formatter,
    display_map,
    compare(version_a, version_b) {
      const a = parse(version_a);
      const b = parse(version_b);
      if (a.major !== b.major) {
        return a.major > b.major ? 1 : -1;
      }
      if (a.minor !== b.minor) {
        return a.minor > b.minor ? 1 : -1;
      }
      if (a.patch !== b.patch) {
        return a.patch > b.patch ? 1 : -1;
      }
      return 0;
    },
    validate({ version }) {
      return SEMVER_REGEX.test(version);
    },
    bump({ version, changes }): string {
      const parsed = parse(version);

      // Determine highest precedence change type
      let highest_type: SemanticChangeKind = "patch";
      const precedence = { major: 3, minor: 2, patch: 1 } satisfies Record<
        SemanticChangeKind,
        number
      >;

      for (const change of changes) {
        if (precedence[change.kind] > precedence[highest_type]) {
          highest_type = change.kind;
        }
      }

      if (highest_type === "major") {
        parsed.major++;
        parsed.minor = 0n;
        parsed.patch = 0n;
      } else if (highest_type === "minor") {
        parsed.minor++;
        parsed.patch = 0n;
      } else if (highest_type === "patch") {
        parsed.patch++;
      }

      return format(parsed);
    },
  };
}
