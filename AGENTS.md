# Agent Rules

## Naming Conventions

- **Files**: kebab-case (e.g., `git-platforms.ts`, `change-file.ts`)
- **Variables & Functions**: snake_case (e.g., `base_sha`, `create_or_update_branch()`, `validate_config()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_TIMEOUT`, `CONFIG_CANDIDATES`)

## TypeScript

- Write all code in TypeScript
- Use proper type annotations and explicit return types
- Avoid `any` type
- Strict mode enabled in tsconfig
- Use type-only imports with `type` keyword: `import type { AutoReleaseConfig }`
- Use `const` generics and type inference
- Interfaces for objects, type aliases for primitives/unions
- Helper type like `Pretty<T>` for better type formatting

## Imports

- Always use explicit `.ts` file extensions
- Node.js built-ins use `node:` prefix: `import { pathToFileURL } from "node:url"`
- Local imports use relative paths: `import * as fs from "./utils/fs.ts"`
- Type-only imports use `type` keyword
- Group imports: built-ins, external packages, then local modules

## Formatting

- Run `pnpm format` to format files before committing
- 2 space indentation
- Keep lines reasonably short (typically under 100 chars)
- Destructuring for options and parameters
- Use consistent spacing around operators

## Error Handling

- Prefer returning values over throwing errors as the default approach
- Only throw errors for truly exceptional cases
- Some functions return `Error` objects instead of throwing
- Include context in error messages (file paths, config names)
- Use try/catch for operations that can fail gracefully
- Validate input early and return helpful error messages

## Coding Approaches

- Use private class fields with `#` prefix
- Use getters for computed properties
- Async/await for all async operations
- Early returns for clarity
- Break complex logic into helper functions
- Use const assertions for type narrowing: `as const`
- Prefer return values over exceptions when possible
- Always update tests when modifying functionality

## Testing

- Use Vitest: `pnpm test` to run all tests
- Run single test: `pnpm test path/to/test.test.ts` or `pnpm test -t "test name"`
- Arrange-Act-Assert structure in tests
- Test files use `.test.ts` suffix in `/tests` directory
- Use `describe`, `it`, `expect` from Vitest

## Dependencies

- Minimize external dependencies
- Prefer Node.js built-in modules
- Only add dependencies when absolutely necessary
- Check existing code before adding new packages

## Build/Lint/Test Commands

- `pnpm build` - Build the project with tsdown
- `pnpm dev` - Watch mode for development
- `pnpm test` - Run all tests with Vitest
- `pnpm typecheck` - Run TypeScript type checking (tsc --noEmit)
- `pnpm lint` - Run oxlint linter
- `pnpm format` - Format files with oxfmt

## Execution

- Node can run TypeScript files by default
- Do not use ts-node, tsx, or other TypeScript runners
- Run files directly with `node file.ts`
- Build output goes to `dist/` directory
