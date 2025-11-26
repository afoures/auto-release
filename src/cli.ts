#!/usr/bin/env node

import { parseArgs } from "node:util";
import { load_config } from "./config.js";
import { validate } from "./commands/validate.js";
import { change } from "./commands/change.js";
import { preview } from "./commands/preview.js";
import { release } from "./commands/release.js";
import { deploy } from "./commands/deploy.js";

const COMMANDS = [
  "validate",
  "change",
  "preview",
  "release",
  "deploy",
] as const;
type Command = (typeof COMMANDS)[number];

interface GlobalOptions {
  config?: string;
  help?: boolean;
}

interface CommandOptions extends GlobalOptions {
  app?: string;
  type?: string;
  summary?: string;
  description?: string;
  dry_run?: boolean;
  yes?: boolean;
  json?: boolean;
}

/**
 * Display help message
 */
function show_help(command?: Command) {
  if (!command) {
    console.log(`
auto-release - Changesets-inspired release management tool

Usage:
  auto-release <command> [options]

Commands:
  validate    Validate configuration, packages, and change files
  change      Create a new change file
  preview     Preview what would be released
  release     Release apps with pending changes
  deploy      Deploy apps and create git tags

Options:
  --config <path>    Path to config file (default: auto-release.config.ts)
  --help             Show help

Run 'auto-release <command> --help' for command-specific help.
`);
    return;
  }

  const helps: Record<Command, string> = {
    validate: `
auto-release validate - Validate configuration and change files

Usage:
  auto-release validate [options]

Options:
  --config <path>    Path to config file
  --json             Output as JSON
  --help             Show help
`,
    change: `
auto-release change - Create a new change file

Usage:
  auto-release change [options]

Options:
  --app <name>           App name (will prompt if not provided)
  --type <type>          Change type (will prompt if not provided)
  --summary <text>       Summary of the change
  --description <text>   Detailed description
  --config <path>        Path to config file
  --help                 Show help
`,
    preview: `
auto-release preview - Preview what would be released

Usage:
  auto-release preview [options]

Options:
  --app <name>       Filter by app name
  --config <path>    Path to config file
  --help             Show help
`,
    release: `
auto-release release - Release apps with pending changes

Usage:
  auto-release release [options]

Options:
  --app <name>       Filter by app name
  --dry-run          Show what would be done without making changes
  --yes              Skip confirmation prompt
  --config <path>    Path to config file
  --help             Show help
`,
    deploy: `
auto-release deploy - Deploy apps and create git tags

Usage:
  auto-release deploy [options]

Options:
  --app <name>       Filter by app name
  --dry-run          Show what would be done without making changes
  --yes              Skip confirmation prompt
  --config <path>    Path to config file
  --help             Show help
`,
  };

  console.log(helps[command]);
}

/**
 * Main CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    show_help();
    process.exit(0);
  }

  const command = args[0] as Command;

  if (!COMMANDS.includes(command)) {
    console.error(`Unknown command: ${command}`);
    console.error(`Available commands: ${COMMANDS.join(", ")}`);
    process.exit(1);
  }

  // Parse arguments
  const { values } = parseArgs({
    args: args.slice(1),
    options: {
      config: { type: "string" },
      app: { type: "string" },
      type: { type: "string" },
      summary: { type: "string" },
      description: { type: "string" },
      "dry-run": { type: "boolean" },
      yes: { type: "boolean" },
      json: { type: "boolean" },
      help: { type: "boolean" },
    },
    allowPositionals: true,
  });

  const options: CommandOptions = {
    config: values.config,
    app: values.app,
    type: values.type,
    summary: values.summary,
    description: values.description,
    dry_run: values["dry-run"],
    yes: values.yes,
    json: values.json,
    help: values.help,
  };

  if (options.help) {
    show_help(command);
    process.exit(0);
  }

  try {
    // Load config (except for help)
    const config = await load_config(
      options.config || "auto-release.config.ts"
    );

    // Execute command
    switch (command) {
      case "validate": {
        const result = await validate({
          config,
          json: options.json,
        });
        process.exit(result.valid ? 0 : 1);
      }

      case "change": {
        await change({
          config,
          app: options.app,
          type: options.type,
          summary: options.summary,
          description: options.description,
        });
        break;
      }

      case "preview": {
        await preview({
          config,
          app: options.app,
        });
        break;
      }

      case "release": {
        await release({
          config,
          app: options.app,
          dry_run: options.dry_run,
          yes: options.yes,
        });
        break;
      }

      case "deploy": {
        await deploy({
          config,
          app: options.app,
          dry_run: options.dry_run,
          yes: options.yes,
        });
        break;
      }
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
