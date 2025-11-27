#!/usr/bin/env node

import { parseArgs } from "node:util";
import { load_config } from "./config.js";
import { validate } from "./commands/validate.js";
import { change } from "./commands/change.js";
import { preview } from "./commands/preview.js";
import { release } from "./commands/release.js";
import { deploy } from "./commands/deploy.js";
import type { Command } from "./commands/types.js";
import { generate_help } from "./commands/types.js";

const commands = {
  validate,
  change,
  preview,
  release,
  deploy,
};

/**
 * Display help message
 */
function show_help(command?: Command<any>) {
  if (!command) {
    const command_list = Object.values(commands)
      .map((cmd) => `  ${cmd.name.padEnd(12)} ${cmd.description}`)
      .join("\n");

    console.log(`
auto-release - Changesets-inspired release management tool

Usage:
  auto-release <command> [options]

Commands:
${command_list}

Options:
  --config <path>    Path to config file (default: auto-release.config.ts)
  --help             Show help

Run 'auto-release <command> --help' for command-specific help.
`);
    return;
  }

  console.log(generate_help(command.name, command.description, command.schema));
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

  const command_name = args[0];
  const command = commands[command_name as keyof typeof commands];

  if (!command) {
    show_help();
    process.exit(1);
  }

  // Parse arguments using command's schema
  const { values } = parseArgs({
    args: args.slice(1),
    options: {
      ...command.schema,
      config: { type: "string" as const },
      help: { type: "boolean" as const },
    },
    allowPositionals: true,
  });

  if (values.help) {
    show_help(command);
    process.exit(0);
  }

  try {
    // Load config
    const config = await load_config(values.config || "auto-release.config.ts");

    // Execute command
    const result = await command.run({ values: values as any, config });

    // Handle exit code based on result
    if (!result.ok) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
