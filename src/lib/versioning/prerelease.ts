import { regex } from "arkregex";

/**
 * Pre-release suffix handling shared across every versioning scheme.
 *
 * A pre-release version is `<base>-<channel>.<id>` (e.g. `1.2.3-rc.3`,
 * `2025.1.2-preview.a1b2c3d`). The `<base>` is produced by each scheme's own
 * versioning logic, so suffixing is scheme-agnostic and lives here.
 *
 * Note: the separator is `-`, so a scheme's base format must not contain `-`
 * (semver/calver/markver are digit/dot-only, so they comply).
 */

export interface PrereleaseSuffix {
  channel: string;
  id: string;
}

const CHANNEL_REGEX = regex("^[a-z][a-z0-9]*$");
const ID_REGEX = regex("^[0-9a-z-]+$");
const SUFFIX_REGEX = regex("^(?<channel>[a-z][a-z0-9]*)\\.(?<id>[0-9a-z-]+)$");
const NUMERIC_REGEX = regex("^\\d+$");

/**
 * Build a pre-release version string, validating the channel and id.
 * @throws if the channel or id contain unsupported characters
 */
export function format_prerelease(base: string, channel: string, id: string): string {
  if (!CHANNEL_REGEX.test(channel)) {
    throw new Error(
      `Invalid pre-release channel: "${channel}" (expected lowercase letters/digits starting with a letter, e.g. "alpha", "rc")`,
    );
  }
  if (!ID_REGEX.test(id)) {
    throw new Error(
      `Invalid pre-release id: "${id}" (expected lowercase letters, digits or hyphens, e.g. "3" or "a1b2c3d")`,
    );
  }
  return `${base}-${channel}.${id}`;
}

/**
 * Split a version into its base and (optional) pre-release suffix.
 * Only splits when the suffix is a well-formed `<channel>.<id>`; otherwise the whole
 * string is returned as the base so downstream validation rejects it.
 */
export function split_prerelease(version: string): {
  base: string;
  suffix: PrereleaseSuffix | null;
} {
  const dash_index = version.indexOf("-");
  if (dash_index === -1) {
    return { base: version, suffix: null };
  }
  const base = version.slice(0, dash_index);
  const suffix_text = version.slice(dash_index + 1);
  const match = SUFFIX_REGEX.exec(suffix_text);
  if (!match) {
    return { base: version, suffix: null };
  }
  return { base, suffix: { channel: match.groups.channel, id: match.groups.id } };
}

/** Whether a version string carries a pre-release suffix. */
export function is_prerelease(version: string): boolean {
  return split_prerelease(version).suffix !== null;
}

/** Strip any pre-release suffix, returning the base version. */
export function base_version(version: string): string {
  return split_prerelease(version).base;
}

/**
 * Compare two pre-release suffixes (assuming equal bases), following SemVer §11:
 * a version with no suffix outranks the same base with a suffix; otherwise compare
 * channel lexically, then id (numerically when both are numeric, else lexically).
 */
export function compare_prerelease(
  a: PrereleaseSuffix | null,
  b: PrereleaseSuffix | null,
): -1 | 0 | 1 {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (a.channel !== b.channel) return a.channel < b.channel ? -1 : 1;
  const a_numeric = NUMERIC_REGEX.test(a.id);
  const b_numeric = NUMERIC_REGEX.test(b.id);
  if (a_numeric && b_numeric) {
    const an = BigInt(a.id);
    const bn = BigInt(b.id);
    if (an === bn) return 0;
    return an < bn ? -1 : 1;
  }
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}
