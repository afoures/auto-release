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
  - `validate`: Validate configuration, packages, and change files
  - `change`: Create new change files interactively or via CLI
  - `preview`: Preview next release without making changes
  - `release`: Update versions, generate changelogs, and consume changes
  - `deploy`: Run deployment commands/handlers and create git tags

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

