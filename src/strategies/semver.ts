import type { VersionStrategy } from '../types.js'

interface SemverParsed {
  major: number
  minor: number
  patch: number
}

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/

/**
 * Semver versioning strategy
 * Supports change types: major, minor, patch, none
 */
export const semver_strategy: VersionStrategy = {
  id: 'semver',
  change_types: ['major', 'minor', 'patch', 'none'] as const,

  parse(version: string): SemverParsed {
    const match = version.match(SEMVER_REGEX)
    if (!match) {
      throw new Error(`Invalid semver version: ${version}`)
    }
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
    }
  },

  format(parsed: unknown): string {
    const { major, minor, patch } = parsed as SemverParsed
    return `${major}.${minor}.${patch}`
  },

  bump({ current_version, changes }): string {
    const parsed = this.parse(current_version) as SemverParsed

    // Determine highest precedence change type
    let highest_type: 'major' | 'minor' | 'patch' | 'none' = 'none'
    const precedence = { major: 3, minor: 2, patch: 1, none: 0 }

    for (const change of changes) {
      const type = change.type as keyof typeof precedence
      if (precedence[type] > precedence[highest_type]) {
        highest_type = type
      }
    }

    // Apply bump
    if (highest_type === 'major') {
      parsed.major++
      parsed.minor = 0
      parsed.patch = 0
    } else if (highest_type === 'minor') {
      parsed.minor++
      parsed.patch = 0
    } else if (highest_type === 'patch') {
      parsed.patch++
    }
    // 'none' doesn't bump the version

    return this.format(parsed)
  },
}
