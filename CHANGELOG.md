# auto-release

## 0.1.0 – 2025-11-26

### Major

- Initial release of auto-release
- Changesets-inspired release management tool for monorepos
- App-centric versioning with multi-package support

### Features

- **Core Functionality**
  - Configuration loading from `auto-release.config.ts`
  - TypeScript-first with full type safety
  - Support for ESM modules (Node.js >= 22)

- **Versioning Strategies**
  - Built-in semver strategy (major.minor.patch)
  - Built-in calver strategy (YYYY.MM.micro)
  - Custom strategy support with pluggable interface

- **CLI Commands**
  - `check`: Validate configuration, packages, and change files
  - `record`: Record new changes interactively or via CLI
  - `generate-release`: Create or update release PRs (with enhanced `--dry-run` showing detailed changes)
  - `tag-release`: Create git tags and releases after release PR merge

- **Change File Management**
  - Markdown-based change files with validation
  - Structured naming: `type.slug.md`
  - Support for titles and detailed descriptions
  - Organized by app in `.changes/<appName>/`

- **Changelog Generation**
  - Automated changelog updates per app
  - Changes grouped by type
  - Customizable changelog paths
  - Markdown formatting with dates

- **Deployment**
  - Shell command execution
  - Custom handler functions with context
  - Git tag creation with templates
  - Deployment failure handling (no tags on failure)

- **Developer Experience**
  - Interactive prompts for user-friendly workflows
  - Dry-run mode for all commands
  - JSON output for CI integration
  - Comprehensive validation with helpful error messages

### Documentation

- Comprehensive README with examples
- Example configurations for common scenarios
- TypeScript API documentation
- Contributing guidelines

