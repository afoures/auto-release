# Naming Convention Refactoring

This document summarizes the refactoring to follow the AGENT.md naming conventions.

## Changes Made

Following the AGENT.md naming conventions:
- **Files**: kebab-case ✅ (already correct)
- **Variables & Functions**: snake_case ✅ (refactored from camelCase)
- **Constants**: UPPER_SNAKE_CASE ✅ (applied)

## Refactored Files

### Core Source Files (21 files)
1. `src/types.ts` - All interface properties and types
2. `src/versioning/semver.ts` - `semver_strategy`, all functions
3. `src/versioning/calver.ts` - `calver_strategy`, all functions
4. `src/config.ts` - `define_config`, `load_config`, `validate_config`, etc.
5. `src/changes.ts` - `parse_change_filename`, `discover_changes`, etc.
6. `src/packages.ts` - `resolve_packages`, `get_current_version`, `write_version`, etc.
7. `src/changelog.ts` - `get_changelog_path`, `generate_changelog_section`, etc.
8. `src/utils/logger.ts` - `create_logger`
9. `src/utils/exec.ts` - `exec_promise`, all functions
10. `src/utils/prompts.ts` - `default_value`, all functions
11. `src/commands/validate.ts` - `package_validation`, all functions
12. `src/commands/change.ts` - `app_name`, `change_type`, `full_slug`, etc.
13. `src/commands/preview.ts` - `app_filter`, `current_version`, `next_version`, etc.
14. `src/commands/release.ts` - `dry_run`, `app_filter`, `changelog_path`, etc.
15. `src/commands/deploy.ts` - `dry_run`, `app_filter`, `format_tag`, etc.
16. `src/cli.ts` - `show_help`, `dry_run`, all functions
17. `src/index.ts` - Public API exports updated

### Test Files (5 files)
18. `tests/index.test.ts` - `define_config`, `semver_strategy`, etc.
19. `tests/versioning.test.ts` - `semver_strategy`, `calver_strategy`, all properties
20. `tests/changes.test.ts` - `parse_change_filename`, `parse_change_markdown`
21. `tests/config.test.ts` - `define_config`, `semver_strategy`
22. `tests/changelog.test.ts` - `generate_changelog_section`, all properties

### Example Files (5 files)
23. `examples/single-app.config.ts` - All config properties
24. `examples/monorepo.config.ts` - All config properties
25. `examples/calver.config.ts` - `calver_strategy`, all properties
26. `examples/custom-strategy.config.ts` - `custom_strategy`, all properties
27. `auto-release.config.example.ts` - All config properties

### Documentation
28. `README.md` - All code examples updated to snake_case

## Key Changes

### Interface Properties
```typescript
// Before
interface ResolvedChange {
  appName: string
  filePath: string
}

// After
interface ResolvedChange {
  app_name: string
  file_path: string
}
```

### Function Names
```typescript
// Before
export function defineConfig(config) { }
export const semverStrategy = { }
export async function getCurrentVersion() { }

// After
export function define_config(config) { }
export const semver_strategy = { }
export async function get_current_version() { }
```

### Variables
```typescript
// Before
const currentVersion = await getCurrentVersion()
const changeType = options.type
const appName = 'my-app'

// After
const current_version = await get_current_version()
const change_type = options.type
const app_name = 'my-app'
```

### Constants
```typescript
// Before
const builtinStrategies = { }
const SEMVER_REGEX = /.../ // Already correct

// After
const BUILTIN_STRATEGIES = { }
const SEMVER_REGEX = /.../ // Unchanged
```

## Verification

All refactoring verified and passing:

✅ **Type Check**: `pnpm typecheck` - No errors  
✅ **Build**: `pnpm build` - Success  
✅ **Tests**: `pnpm test` - 29/29 passing  
✅ **CLI**: `node dist/cli.mjs --help` - Working  

## Breaking Changes

This is a **breaking change** for users of the library:

### Public API Changes
- `defineConfig` → `define_config`
- `semverStrategy` → `semver_strategy`
- `calverStrategy` → `calver_strategy`
- All interface properties (e.g., `changeTypes` → `change_types`)

### Migration Guide for Users

Update your `auto-release.config.ts`:

```typescript
// Before
import { defineConfig, semverStrategy } from 'auto-release'

export default defineConfig({
  apps: [{
    versioning: {
      strategy: semverStrategy,
      changeTypes: ['major', 'minor'],
    }
  }],
  changesDir: '.changes',
})

// After
import { define_config, semver_strategy } from 'auto-release'

export default define_config({
  apps: [{
    versioning: {
      strategy: semver_strategy,
      change_types: ['major', 'minor'],
    }
  }],
  changes_dir: '.changes',
})
```

## Files Modified

- **Source files**: 17 files
- **Test files**: 5 files  
- **Example files**: 5 files
- **Documentation**: 1 file

**Total**: 28 files refactored to follow AGENT.md conventions

## Result

The entire codebase now follows the AGENT.md naming conventions:
- ✅ Files in kebab-case
- ✅ Variables and functions in snake_case  
- ✅ Constants in UPPER_SNAKE_CASE
- ✅ All tests passing
- ✅ Full type safety maintained
- ✅ Documentation updated

