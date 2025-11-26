import { describe, it, expect } from 'vitest'
import { generate_changelog_section } from '../src/changelog.js'
import { semver_strategy } from '../src/strategies/semver.js'
import type { AppConfig, ResolvedChange } from '../src/types.js'

describe('generate_changelog_section', () => {
  const app: AppConfig = {
    name: 'test-app',
    packages: ['packages/test'],
    versioning: {
      strategy: semver_strategy,
      change_types: ['major', 'minor', 'patch', 'none'],
    },
  }

  it('should generate changelog section with grouped changes', () => {
    const changes: ResolvedChange[] = [
      {
        app_name: 'test-app',
        type: 'major',
        title: 'Breaking API change',
        file_path: '/changes/major.breaking.md',
      },
      {
        app_name: 'test-app',
        type: 'minor',
        title: 'Add new feature',
        file_path: '/changes/minor.feature.md',
      },
      {
        app_name: 'test-app',
        type: 'patch',
        title: 'Fix bug',
        file_path: '/changes/patch.fix.md',
      },
    ]

    const section = generate_changelog_section({
      app,
      current_version: '1.0.0',
      next_version: '2.0.0',
      date: new Date('2025-11-26'),
      changes,
      strategy: semver_strategy,
    })

    expect(section).toContain('## 2.0.0 – 2025-11-26')
    expect(section).toContain('### Major')
    expect(section).toContain('- Breaking API change')
    expect(section).toContain('### Minor')
    expect(section).toContain('- Add new feature')
    expect(section).toContain('### Patch')
    expect(section).toContain('- Fix bug')
  })

  it('should include body content if present', () => {
    const changes: ResolvedChange[] = [
      {
        app_name: 'test-app',
        type: 'minor',
        title: 'Add authentication',
        body: 'This adds JWT-based authentication with refresh tokens.',
        file_path: '/changes/minor.auth.md',
      },
    ]

    const section = generate_changelog_section({
      app,
      current_version: '1.0.0',
      next_version: '1.1.0',
      date: new Date('2025-11-26'),
      changes,
      strategy: semver_strategy,
    })

    expect(section).toContain('- Add authentication')
    expect(section).toContain('This adds JWT-based authentication')
  })
})
