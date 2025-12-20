import { regex } from "arkregex";
import type { ChangeFile } from "../change-file.ts";
import type { ChangeKindDisplayMap, Formatter, VersionManager } from "./types.ts";
import { default_formatter } from "../formatter.ts";

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

type CalendarChangeKind = "feature" | "fix";

/**
 * Create a calendar versioning manager
 *
 * Format: year.minor.patch (e.g., 2025.1.2)
 */
export function calver<
  parsed_changelog extends {
    releases: Array<{
      version: string;
      changes: Array<ChangeFile<CalendarChangeKind>>;
    }>;
  },
>({
  formatter: custom_formatter,
  display_map: custom_display_map,
}:
  | {
      formatter: Formatter<CalendarChangeKind, parsed_changelog>;
      display_map?: ChangeKindDisplayMap<CalendarChangeKind>;
    }
  | {
      formatter?: never;
      display_map?: ChangeKindDisplayMap<CalendarChangeKind>;
    } = {}): VersionManager<CalendarChangeKind, any> {
  const allowed_changes = ["feature", "fix"] as const;
  const display_map =
    custom_display_map ??
    ({
      feature: { singular: "Feature", plural: "Features" },
      fix: { singular: "Bug Fix", plural: "Bug Fixes" },
    } satisfies ChangeKindDisplayMap<CalendarChangeKind>);
  const formatter = custom_formatter || default_formatter({ allowed_changes, display_map });

  return {
    allowed_changes,
    hotfix_allowed_changes: ["fix"] as const,
    initial_version: "0.0.0",
    formatter,
    display_map,
    compare(version_a, version_b) {
      const a = parse(version_a);
      const b = parse(version_b);
      if (a.year !== b.year) {
        return a.year > b.year ? 1 : -1;
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
      return CALVER_REGEX.test(version);
    },
    bump({ version, changes, date, reason }): string {
      const parsed = parse(version);
      const current_year = BigInt(date.getFullYear());

      let highest_type: CalendarChangeKind = "fix";
      const precedence = { feature: 2, fix: 1 } satisfies Record<CalendarChangeKind, number>;

      for (const change of changes) {
        if (precedence[change.kind] > precedence[highest_type]) {
          highest_type = change.kind;
        }
      }

      // For hotfixes, use the year of the current version instead of the current date's year
      // This allows hotfixing older versions without changing the year
      const year_to_use =
        reason === "hotfix" && parsed.year !== current_year ? parsed.year : current_year;

      if (parsed.year === year_to_use) {
        if (highest_type === "feature") {
          parsed.minor++;
          parsed.patch = 0n;
        } else if (highest_type === "fix") {
          parsed.patch++;
        }
      } else {
        parsed.year = year_to_use;
        parsed.minor = 1n;
        parsed.patch = 0n;
      }

      return format(parsed);
    },
  };
}
