import { describe, it, expect } from 'vitest'
import { semver_strategy } from '../src/strategies/semver.js'
import { calver_strategy } from '../src/strategies/calver.js'
import type { ResolvedChange } from '../src/types.js'

describe('semver_strategy', () => {
  it('should parse valid semver versions', () => {
    expect(semver_strategy.parse('1.2.3')).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
    })
  })

  it('should throw on invalid semver', () => {
    expect(() => semver_strategy.parse('1.2')).toThrow('Invalid semver version')
  })

  it('should format semver versions', () => {
    expect(
      semver_strategy.format({ major: 1, minor: 2, patch: 3 })
    ).toBe('1.2.3')
  })

  it('should bump major version', () => {
    const changes: ResolvedChange[] = [
      {
        app_name: 'test',
        type: 'major',
        title: 'Breaking change',
        file_path: '/test.md',
      },
    ]
    const result = semver_strategy.bump({
      current_version: '1.2.3',
      changes,
      now: new Date(),
    })
    expect(result).toBe('2.0.0')
  })

  it('should bump minor version', () => {
    const changes: ResolvedChange[] = [
      {
        app_name: 'test',
        type: 'minor',
        title: 'New feature',
        file_path: '/test.md',
      },
    ]
    const result = semver_strategy.bump({
      current_version: '1.2.3',
      changes,
      now: new Date(),
    })
    expect(result).toBe('1.3.0')
  })

  it('should bump patch version', () => {
    const changes: ResolvedChange[] = [
      {
        app_name: 'test',
        type: 'patch',
        title: 'Bug fix',
        file_path: '/test.md',
      },
    ]
    const result = semver_strategy.bump({
      current_version: '1.2.3',
      changes,
      now: new Date(),
    })
    expect(result).toBe('1.2.4')
  })

  it('should not bump on "none" type', () => {
    const changes: ResolvedChange[] = [
      {
        app_name: 'test',
        type: 'none',
        title: 'Documentation update',
        file_path: '/test.md',
      },
    ]
    const result = semver_strategy.bump({
      current_version: '1.2.3',
      changes,
      now: new Date(),
    })
    expect(result).toBe('1.2.3')
  })

  it('should use highest precedence when multiple changes', () => {
    const changes: ResolvedChange[] = [
      {
        app_name: 'test',
        type: 'patch',
        title: 'Bug fix',
        file_path: '/test1.md',
      },
      {
        app_name: 'test',
        type: 'major',
        title: 'Breaking change',
        file_path: '/test2.md',
      },
      {
        app_name: 'test',
        type: 'minor',
        title: 'New feature',
        file_path: '/test3.md',
      },
    ]
    const result = semver_strategy.bump({
      current_version: '1.2.3',
      changes,
      now: new Date(),
    })
    expect(result).toBe('2.0.0')
  })
})

describe('calver_strategy', () => {
  it('should parse valid calver versions', () => {
    expect(calver_strategy.parse('2025.11.5')).toEqual({
      year: 2025,
      month: 11,
      micro: 5,
    })
  })

  it('should throw on invalid calver', () => {
    expect(() => calver_strategy.parse('2025-11-5')).toThrow(
      'Invalid calver version'
    )
  })

  it('should format calver versions with padded month', () => {
    expect(
      calver_strategy.format({ year: 2025, month: 3, micro: 1 })
    ).toBe('2025.03.1')
  })

  it('should increment micro when same month', () => {
    const changes: ResolvedChange[] = [
      {
        app_name: 'test',
        type: 'feature',
        title: 'New feature',
        file_path: '/test.md',
      },
    ]
    const now = new Date('2025-11-26')
    const result = calver_strategy.bump({
      current_version: '2025.11.0',
      changes,
      now,
    })
    expect(result).toBe('2025.11.1')
  })

  it('should reset micro when different month', () => {
    const changes: ResolvedChange[] = [
      {
        app_name: 'test',
        type: 'feature',
        title: 'New feature',
        file_path: '/test.md',
      },
    ]
    const now = new Date('2025-12-01')
    const result = calver_strategy.bump({
      current_version: '2025.11.5',
      changes,
      now,
    })
    expect(result).toBe('2025.12.0')
  })

  it('should return current version when no changes', () => {
    const result = calver_strategy.bump({
      current_version: '2025.11.0',
      changes: [],
      now: new Date('2025-11-26'),
    })
    expect(result).toBe('2025.11.0')
  })
})
