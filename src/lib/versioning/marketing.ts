import { regex } from "arkregex";
import type { ChangeFile } from "../change-file.ts";
import type { ChangeKindDisplayMap, Formatter, VersionManager } from "./types.ts";
import { default_formatter } from "../formatter.ts";

interface MarketingVersion {
  marketing: bigint;
  minor: bigint;
  patch: bigint;
}

const MARKVER_REGEX = regex("^(?<marketing>\\d+).(?<minor>\\d+).(?<patch>\\d+)$");

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

type MarketingChangeKind = "marketing" | "feature" | "fix";

/**
 * Marketing versioning strategy factory
 *
 * Format: marketing.minor.patch (e.g., 1.0.0)
 */
export function markver<
  parsed_changelog extends {
    releases: Array<{
      version: string;
      changes: Array<ChangeFile<MarketingChangeKind>>;
    }>;
  },
>({
  formatter: custom_formatter,
  display_map: custom_display_map,
}:
  | {
      formatter: Formatter<MarketingChangeKind, parsed_changelog>;
      display_map?: ChangeKindDisplayMap<MarketingChangeKind>;
    }
  | {
      formatter?: never;
      display_map?: ChangeKindDisplayMap<MarketingChangeKind>;
    } = {}): VersionManager<MarketingChangeKind, any> {
  const allowed_changes = ["marketing", "feature", "fix"] as const;
  const display_map =
    custom_display_map ??
    ({
      marketing: { singular: "Marketing", plural: "Marketing" },
      feature: { singular: "Feature", plural: "Features" },
      fix: { singular: "Bug Fix", plural: "Bug Fixes" },
    } satisfies ChangeKindDisplayMap<MarketingChangeKind>);
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
      if (a.marketing !== b.marketing) return a.marketing > b.marketing ? 1 : -1;
      if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
      if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
      return 0;
    },
    validate({ version }) {
      return MARKVER_REGEX.test(version);
    },
    bump({ version, changes }): string {
      const parsed = parse(version);
      // will always increase patch version if no other change type is present
      let highest_type: MarketingChangeKind = "fix";
      const precedence = { marketing: 3, feature: 2, fix: 1 } satisfies Record<
        MarketingChangeKind,
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
