# Contributing to auto-release

Thank you for considering contributing to auto-release!

## Development Setup

1. Clone the repository:

```bash
git clone https://github.com/afoures/auto-release.git
cd auto-release
```

2. Install dependencies:

```bash
pnpm install
```

3. Build the project:

```bash
pnpm build
```

4. Run tests:

```bash
pnpm test
```

5. Type check:

```bash
pnpm typecheck
```

## Project Structure

```
auto-release/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── bin.ts                      # CLI entry point
│   ├── lib/
│   │   ├── types.ts                # Core type definitions
│   │   ├── config.ts               # Config loading & validation
│   │   ├── changes.ts              # Change file discovery & parsing
│   │   ├── formatter.ts            # Changelog & release note formatting
│   │   ├── cli.ts                  # CLI framework
│   │   ├── commands/
│   │   │   ├── check.ts            # Check command
│   │   │   ├── record.ts           # Record command
│   │   │   ├── generate-release.ts # Generate release PRs
│   │   │   ├── tag-release.ts     # Tag releases
│   │   │   └── init.ts             # Init command
│   │   ├── components/
│   │   │   ├── types.ts            # Component interfaces
│   │   │   ├── node.ts             # Node.js component
│   │   │   ├── expo.ts             # Expo component
│   │   │   └── php.ts              # PHP component
│   │   ├── providers/
│   │   │   ├── types.ts            # Git provider interface
│   │   │   ├── github.ts           # GitHub provider
│   │   │   └── gitlab.ts           # GitLab provider
│   │   ├── versioning/
│   │   │   ├── types.ts            # VersionManager & Formatter types
│   │   │   ├── semantic.ts         # Semver strategy
│   │   │   ├── calendar.ts         # Calver strategy
│   │   │   └── marketing.ts        # Marketing versioning
│   │   └── utils/
│   │       ├── logger.ts           # Logging utilities
│   │       └── exec.ts             # Command execution
├── tests/                          # Test files
├── examples/                       # Example configurations
└── README.md                      # Documentation
```

## Key Architecture Concepts

### Record-Based Config

Apps are configured as a **record** (object) keyed by app name, not an array:

```typescript
apps: {
  'app-name': { /* config */ }
}
```

This allows direct lookup by name and clearer organization.

### Component Model

Apps use **components** to define version sources. Components are functions that return:

- `path`: Base path
- `parts`: Array of versioned files/parts

Each part has `get_current_version()` and `update_version()` methods.

### Formatter-Driven Versioning

Versioning strategies (`semver()`, `calver()`) require a **formatter** that controls:

- How changelogs are parsed from markdown
- How changelog sections are formatted
- How release notes are generated

The `default_changelog_formatter()` provides a simple default, but custom formatters can fully customize output.

### Git Provider Abstraction

Git operations are abstracted through the `GitProvider` interface, supporting:

- GitHub (via REST API)
- GitLab (via REST API)
- Extensible for other providers

All provider calls use `config.git.default_target_branch` consistently.

## Development Workflow

1. Create a feature branch:

```bash
git checkout -b feature/your-feature
```

2. Make your changes and add tests

3. Ensure tests pass:

```bash
pnpm test
```

4. Ensure type checking passes:

```bash
pnpm typecheck
```

5. Build to verify:

```bash
pnpm build
```

6. Commit your changes:

```bash
git commit -m "feat: add your feature"
```

7. Push and create a pull request

## Testing

- Unit tests are in the `tests/` directory
- Tests use Vitest
- Aim for good test coverage of new features

## Code Style

- TypeScript with strict mode enabled
- ESM modules only (no CommonJS)
- Descriptive variable and function names
- Comments for complex logic
- **Naming conventions**:
  - Files: kebab-case (e.g., `user-service.ts`)
  - Variables & Functions: snake_case (e.g., `user_name`, `get_user_data()`)
  - Constants: UPPER_SNAKE_CASE (e.g., `MAX_TIMEOUT`)
- **Error handling**: Prefer returning values over throwing errors when possible
- Always update tests when making changes

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include tests for new functionality
- Update documentation as needed
- Ensure all checks pass

## Questions?

Feel free to open an issue for discussion before starting work on a major feature.
