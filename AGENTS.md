# Agent Rules

## Naming Conventions
- **Files**: kebab-case (e.g., `user-service.ts`)
- **Variables & Functions**: snake_case (e.g., `user_name`, `get_user_data()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_TIMEOUT`)

## TypeScript
- Write all code in TypeScript
- Use proper type annotations
- Avoid `any` type
- Enable strict mode

## Dependencies
- Minimize external dependencies
- Prefer Node.js built-in modules
- Only add dependencies when absolutely necessary

## Execution
- Node can run TypeScript files by default
- Do not use ts-node, tsx, or other TypeScript runners
- Run files directly with `node file.ts`
