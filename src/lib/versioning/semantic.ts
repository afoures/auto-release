import { regex } from "arkregex";
import type { VersioningStrategy } from "./types.js";

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

/**
 * Semantic versioning strategy factory
 *
 * Format: major.minor.patch (e.g., 1.0.0)
 */
export function semver(): VersioningStrategy {
  return {
    change_types: ["major", "minor", "patch"] as const,

    bump({ current_version, changes }): string {
      const parsed = parse(current_version);

      // Determine highest precedence change type
      let highest_type: "major" | "minor" | "patch" = "patch";
      const precedence = { major: 3, minor: 2, patch: 1 };

      for (const change of changes) {
        const type = change.type as keyof typeof precedence;
        if (precedence[type] > precedence[highest_type]) {
          highest_type = type;
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
