import { describe, it, expect } from 'vitest'
import { define_config } from '../src/config.js'
import { semver_strategy } from '../src/strategies/semver.js'

describe('define_config', () => {
  it('should return config as-is', () => {
    const config = define_config({
      apps: [
        {
          name: 'my-app',
          packages: ['packages/app'],
          versioning: {
            strategy: 'semver',
            change_types: ['major', 'minor', 'patch'],
          },
        },
      ],
    })

    expect(config.apps).toHaveLength(1)
    expect(config.apps[0].name).toBe('my-app')
  })

  it('should support custom strategies', () => {
    const config = define_config({
      apps: [
        {
          name: 'my-app',
          packages: ['packages/app'],
          versioning: {
            strategy: semver_strategy,
            change_types: ['major', 'minor', 'patch'],
          },
        },
      ],
    })

    expect(config.apps[0].versioning.strategy).toBe(semver_strategy)
  })
})
