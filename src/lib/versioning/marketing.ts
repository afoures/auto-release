import { regex } from "arkregex";
import type { VersioningStrategy } from "./types.js";

interface MarketingVersion {
  marketing: bigint;
  minor: bigint;
  patch: bigint;
}

const MARKVER_REGEX = regex(
  "^(?<marketing>\\d+).(?<minor>\\d+).(?<patch>\\d+)$"
);

function parse(version: string): MarketingVersion {
  const match = MARKVER_REGEX.exec(version);
  if (!match) {
    throw new Error(`Invalid marketing version: ${version}`);
  }
  return {
    marketing: BigInt(match.groups.marketing),
    minor: BigInt(match.groups.minor),
    patch: BigInt(match.groups.patch),
  };
}

function format(parsed: MarketingVersion): string {
  return `${parsed.marketing}.${parsed.minor}.${parsed.patch}`;
}

/**
 * Marketing versioning strategy factory
 * Format: marketing.minor.patch (e.g., 1.0.0)
 */
export function markver(): VersioningStrategy {
  return {
    change_types: ["marketing", "feature", "fix"] as const,

    bump({ current_version, changes }): string {
      const parsed = parse(current_version);
      let highest_type: "marketing" | "feature" | "fix" = "fix";
      const precedence = { marketing: 3, feature: 2, fix: 1 };

      for (const change of changes) {
        const type = change.type as keyof typeof precedence;
        if (precedence[type] > precedence[highest_type]) {
          highest_type = type;
        }
      }

      // Apply bump
      if (highest_type === "marketing") {
        parsed.marketing++;
        parsed.minor = 0n;
        parsed.patch = 0n;
      } else if (highest_type === "feature") {
        parsed.minor++;
        parsed.patch = 0n;
      } else if (highest_type === "fix") {
        parsed.patch++;
      }

      return format(parsed);
    },
  };
}
