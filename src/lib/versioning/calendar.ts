import { regex } from "arkregex";
import type { Change, Formatter, VersionManager } from "./types.js";
import { default_changelog_formatter } from "../formatter.js";

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

type AllowedChangeKind = "feature" | "fix";

/**
 * Create a calendar versioning manager
 *
 * Format: year.minor.patch (e.g., 2025.1.2)
 */
export function calver<
  parsed_changelog extends {
    releases: Array<{
      version: string;
      changes: Array<Change<AllowedChangeKind>>;
    }>;
  }
>({
  formatter,
}: {
  formatter?: (
    allowed_changes: readonly AllowedChangeKind[]
  ) => Formatter<AllowedChangeKind, parsed_changelog>;
} = {}): VersionManager<AllowedChangeKind, parsed_changelog> {
  const allowed_changes = ["feature", "fix"] as const;
  const formatter_fn = formatter || default_changelog_formatter();

  return {
    allowed_changes,
    formatter: formatter_fn(allowed_changes) as Formatter<
      AllowedChangeKind,
      parsed_changelog
    >,
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
    bump({ version, changes, date }): string {
      const parsed = parse(version);
      const current_year = BigInt(date.getFullYear());

      let highest_type: AllowedChangeKind = "fix";
      const precedence = { feature: 2, fix: 1 } satisfies Record<
        AllowedChangeKind,
        number
      >;

      for (const change of changes) {
        if (precedence[change.kind] > precedence[highest_type]) {
          highest_type = change.kind;
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
