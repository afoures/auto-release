import { regex } from "arkregex";
import type { Change, Formatter, VersionManager } from "./types.js";

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

type AllowedChangeKind = "major" | "minor" | "patch";

/**
 * Semantic versioning strategy factory
 *
 * Format: major.minor.patch (e.g., 1.0.0)
 */
export function semver<
  parsed_changelog extends {
    releases: Array<{
      version: string;
      changes: Array<Change<AllowedChangeKind>>;
    }>;
  }
>({
  formatter,
}: {
  formatter: (
    allowed_changes: readonly AllowedChangeKind[]
  ) => Formatter<AllowedChangeKind, parsed_changelog>;
}): VersionManager<AllowedChangeKind> {
  const allowed_changes = ["major", "minor", "patch"] as const;

  return {
    allowed_changes,
    formatter: formatter(allowed_changes),
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
      let highest_type: AllowedChangeKind = "patch";
      const precedence = { major: 3, minor: 2, patch: 1 } satisfies Record<
        AllowedChangeKind,
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
