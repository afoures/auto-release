import type { VersionStrategy } from "../types.js";

interface CalverParsed {
  year: number;
  month: number;
  micro: number;
}

const CALVER_REGEX = /^(\d{4})\.(\d{2})\.(\d+)$/;

function parse(version: string): CalverParsed {
  const match = version.match(CALVER_REGEX);
  if (!match) {
    throw new Error(`Invalid calver version: ${version}`);
  }
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10),
    micro: parseInt(match[3], 10),
  };
}

function format(parsed: CalverParsed): string {
  const padded_month = parsed.month.toString().padStart(2, "0");
  return `${parsed.year}.${padded_month}.${parsed.micro}`;
}

/**
 * Calver versioning strategy factory
 * Format: YYYY.MM.micro (e.g., 2025.11.0)
 * All changes bump micro, types are for grouping only
 */
export function calver(): VersionStrategy {
  return {
    change_types: ["feature", "fix", "none"] as const,

    bump({ current_version, changes, time }): string {
      // If no changes, return current version
      if (changes.length === 0) {
        return current_version;
      }

      const parsed = parse(current_version);
      const now = time.now();
      const current_year = now.getFullYear();
      const current_month = now.getMonth() + 1; // 0-indexed

      // If current year/month matches, increment micro; otherwise reset to 0
      if (parsed.year === current_year && parsed.month === current_month) {
        parsed.micro++;
      } else {
        parsed.year = current_year;
        parsed.month = current_month;
        parsed.micro = 0;
      }

      return format(parsed);
    },
  };
}
