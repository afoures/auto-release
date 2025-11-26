import type { VersionStrategy } from '../types.js'

interface CalverParsed {
  year: number
  month: number
  micro: number
}

const CALVER_REGEX = /^(\d{4})\.(\d{2})\.(\d+)$/

/**
 * Calver versioning strategy
 * Format: YYYY.MM.micro (e.g., 2025.11.0)
 * All changes bump micro, types are for grouping only
 */
export const calver_strategy: VersionStrategy = {
  id: 'calver',
  change_types: ['feature', 'fix', 'none'] as const,

  parse(version: string): CalverParsed {
    const match = version.match(CALVER_REGEX)
    if (!match) {
      throw new Error(`Invalid calver version: ${version}`)
    }
    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      micro: parseInt(match[3], 10),
    }
  },

  format(parsed: unknown): string {
    const { year, month, micro } = parsed as CalverParsed
    const padded_month = month.toString().padStart(2, '0')
    return `${year}.${padded_month}.${micro}`
  },

  bump({ current_version, changes, now }): string {
    // If no changes, return current version
    if (changes.length === 0) {
      return current_version
    }

    const parsed = this.parse(current_version) as CalverParsed
    const current_year = now.getFullYear()
    const current_month = now.getMonth() + 1 // 0-indexed

    // If current year/month matches, increment micro; otherwise reset to 0
    if (parsed.year === current_year && parsed.month === current_month) {
      parsed.micro++
    } else {
      parsed.year = current_year
      parsed.month = current_month
      parsed.micro = 0
    }

    return this.format(parsed)
  },
}
