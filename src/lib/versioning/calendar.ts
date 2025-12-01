import { regex } from "arkregex";
import type { VersioningStrategy } from "./types.js";

interface CalendarVersion {
  year: bigint;
  minor: bigint;
  patch: bigint;
}

const CALVER_REGEX = regex("^(?<year>\\d{4}).(?<minor>\\d+).(?<patch>\\d+)$");

function parse(version: string): CalendarVersion {
  const match = CALVER_REGEX.exec(version);
  if (!match) {
    throw new Error(`Invalid calendar version: ${version}`);
  }
  return {
    year: BigInt(match.groups.year),
    minor: BigInt(match.groups.minor),
    patch: BigInt(match.groups.patch),
  };
}

function format(parsed: CalendarVersion): string {
  return `${parsed.year}.${parsed.minor}.${parsed.patch}`;
}

/**
 * Calendar versioning strategy factory
 *
 * Format: year.minor.patch (e.g., 2025.1.2)
 */
export function calver(): VersioningStrategy {
  return {
    change_types: ["feature", "fix"] as const,

    bump({ current_version, changes, date }): string {
      if (changes.length === 0) {
        return current_version;
      }

      const parsed = parse(current_version);
      const current_year = BigInt(date.getFullYear());

      let highest_type: "feature" | "fix" = "fix";
      const precedence = { feature: 2, fix: 1 };

      for (const change of changes) {
        const type = change.type as keyof typeof precedence;
        if (precedence[type] > precedence[highest_type]) {
          highest_type = type;
        }
      }

      if (parsed.year === current_year) {
        if (highest_type === "feature") {
          parsed.minor++;
          parsed.patch = 0n;
        } else if (highest_type === "fix") {
          parsed.patch++;
        }
      } else {
        parsed.year = current_year;
        parsed.minor = 1n;
        parsed.patch = 0n;
      }

      return format(parsed);
    },
  };
}
