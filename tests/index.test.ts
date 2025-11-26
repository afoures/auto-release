import { describe, it, expect } from 'vitest'
import { define_config, semver_strategy, calver_strategy } from '../src/index.js'

describe('Public API exports', () => {
  it('should export define_config helper', () => {
    expect(typeof define_config).toBe('function')
  })

  it('should export semver_strategy', () => {
    expect(semver_strategy).toBeDefined()
    expect(semver_strategy.id).toBe('semver')
  })

  it('should export calver_strategy', () => {
    expect(calver_strategy).toBeDefined()
    expect(calver_strategy.id).toBe('calver')
  })

  it('should allow defining a config', () => {
    const config = define_config({
      apps: [
        {
          name: 'test-app',
          packages: ['./packages/test'],
          versioning: {
            strategy: 'semver',
            change_types: ['major', 'minor', 'patch'],
          },
        },
      ],
    })

    expect(config.apps).toHaveLength(1)
    expect(config.apps[0].name).toBe('test-app')
  })
})
