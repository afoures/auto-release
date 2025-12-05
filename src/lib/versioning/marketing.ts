import { regex } from "arkregex";
import type { Change, Formatter, VersionManager } from "./types.js";

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

type AllowedChangeKind = "marketing" | "feature" | "fix";

/**
 * Marketing versioning strategy factory
 *
 * Format: marketing.minor.patch (e.g., 1.0.0)
 */
export function markver<
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
  const allowed_changes = ["marketing", "feature", "fix"] as const;

  return {
    allowed_changes,
    formatter: formatter(allowed_changes),
    compare(version_a, version_b) {
      const a = parse(version_a);
      const b = parse(version_b);
      if (a.marketing !== b.marketing)
        return a.marketing > b.marketing ? 1 : -1;
      if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
      if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
      return 0;
    },
    validate({ version }) {
      return MARKVER_REGEX.test(version);
    },
    bump({ version, changes, date }): string {
      const parsed = parse(version);
      // will always increase patch version if no other change type is present
      let highest_type: AllowedChangeKind = "fix";
      const precedence = { marketing: 3, feature: 2, fix: 1 } satisfies Record<
        AllowedChangeKind,
        number
      >;

      for (const change of changes) {
        if (precedence[change.kind] > precedence[highest_type]) {
          highest_type = change.kind;
        }
      }

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
