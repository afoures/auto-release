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
│   ├── index.ts              # Public API exports
│   ├── cli.ts                # CLI entry point
│   ├── types.ts              # Core type definitions
│   ├── config.ts             # Config loading
│   ├── changes.ts            # Change file handling
│   ├── packages.ts           # Package.json management
│   ├── changelog.ts          # Changelog generation
│   ├── strategies/
│   │   ├── semver.ts         # Semver strategy
│   │   └── calver.ts         # Calver strategy
│   ├── commands/
│   │   ├── check.ts          # Check command
│   │   ├── record.ts         # Record command
│   │   ├── generate-release.ts # Generate release command
│   │   └── tag-release.ts # Tag release command
│   └── utils/
│       ├── logger.ts         # Logging utilities
│       ├── exec.ts           # Command execution
│       └── prompts.ts        # User prompts
├── tests/                    # Test files
├── examples/                 # Example configurations
└── README.md                 # Documentation
```

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

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Include tests for new functionality
- Update documentation as needed
- Ensure all checks pass

## Questions?

Feel free to open an issue for discussion before starting work on a major feature.

