import { regex } from "arkregex";
import {
  type Change,
  type ChangelogContent,
  type ChangelogFormatter,
  type ChangelogVersion,
  type VersioningStrategy,
  type VersionManager,
} from "./index.js";

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

const change_types = ["marketing", "feature", "fix"] as const;
type ChangeTypes = (typeof change_types)[number];

type CalverChangelogContent = ChangelogContent<ChangeTypes> & {
  header: Array<string>;
};

/**
 * Marketing versioning strategy factory
 *
 * Format: marketing.minor.patch (e.g., 1.0.0)
 */
export function markver({
  changelog_formatter: custom_changelog_formatter,
}: {
  changelog_formatter?: ChangelogFormatter<ChangeTypes, CalverChangelogContent>;
} = {}): VersioningStrategy<{
  change_types: ChangeTypes;
  changelog_content: CalverChangelogContent;
}> {
  const version_manager = {
    validate({ version }) {
      return MARKVER_REGEX.test(version);
    },
    bump({ version, changes }) {
      const parsed = parse(version);
      let highest_type: ChangeTypes = "fix";
      const precedence = {
        marketing: 3,
        feature: 2,
        fix: 1,
      } satisfies Record<ChangeTypes, number>;

      for (const change of changes) {
        const type = change.kind;
        if (precedence[type] > precedence[highest_type]) {
          highest_type = type;
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
  } satisfies VersionManager<ChangeTypes>;

  const default_changelog_formatter = {
    parse({ text }) {
      const header: Array<string> = [];
      const versions: Array<ChangelogVersion<ChangeTypes>> = [];
      let context: null | ChangelogVersion<ChangeTypes> = null;
      let change: null | Change<ChangeTypes> = null;
      for (const line of text) {
        if (line.startsWith("##")) {
          context = {
            version: line.split(" ")[1],
            changes: [],
          };
          versions.push(context);
        } else if (!context) {
          header.push(line);
        } else if (context && line.startsWith("-")) {
          change = {
            kind: line.split(" ")[1].slice(1, -1) as ChangeTypes,
            title: line.split(" ").slice(2).join(" "),
          };
          context.changes.push(change);
        } else if (change && line) {
          change.description =
            (change.description ? change.description + "\n" : "") + line;
        }
      }
      return {
        header,
        versions,
      };
    },
    format({ changelog }) {
      const content = changelog.versions.flatMap(({ version, changes }) => {
        return [`## ${version}`].concat(
          changes.flatMap((change) => {
            return [
              `- [${change.kind}] ${change.title}`,
              change.description ? change.description : "",
            ].filter(Boolean);
          })
        );
      });
      return changelog.header.concat(content);
    },
  } satisfies ChangelogFormatter<ChangeTypes, CalverChangelogContent>;

  const changelog_formatter =
    custom_changelog_formatter ?? default_changelog_formatter;

  return {
    change_types,
    version_manager,
    changelog_formatter,
  };
}
