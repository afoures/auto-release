import { parseArgs } from "node:util";
import type { ParseArgsOptionDescriptor } from "node:util";
import { log, cancel } from "@clack/prompts";
import { load_config } from "./config.js";
import type { NormalizedConfig } from "./types.js";

/**
 * Extended option schema with description for help generation
 */
export interface Option extends ParseArgsOptionDescriptor {
  description?: string;
}

type convert_to_values<args extends Record<string, Option>> = {
  [K in keyof args]?: args[K]["type"] extends "string"
    ? string
    : args[K]["type"] extends "boolean"
    ? boolean
    : never;
};

/**
 * Command definition interface
 */
export interface Command<
  args extends Record<string, Option> = Record<string, Option>
> {
  /**
   * Command name (e.g., "validate", "record")
   */
  name: string;

  /**
   * Short description for command listing
   */
  description: string;

  /**
   * Argument parsing schema for node:util parseArgs with descriptions
   */
  schema: args;

  /**
   * Run the command with parsed arguments and config
   */
  run: (args: {
    values: convert_to_values<args>;
    config: NormalizedConfig;
  }) => Promise<
    { status: "success"; message?: string } | { status: "error"; error: string }
  >;
}

/**
 * Command helper function
 */
export function create_command<args extends Record<string, Option>>(
  command: Command<args>
): Command<args> {
  return command;
}

/**
 * Generate help text from command metadata and schema
 */
export function generate_help(
  name: string,
  description: string,
  schema: Record<string, Option>
): string {
  const options: Array<{ name: string; description: string }> = [];

  // Build option names first to calculate max length
  const option_names: string[] = ["--help"];

  // Sort options: config first, then alphabetically
  const sortedKeys = Object.keys(schema).sort((a, b) => {
    if (a === "config") return -1;
    if (b === "config") return 1;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    const option = schema[key];
    const optionName = key.length === 1 ? `-${key}` : `--${key}`;
    const typeHint = option.type === "string" ? " <value>" : "";
    const displayName = `${optionName}${typeHint}`;
    option_names.push(displayName);
  }

  // Calculate max option name length for proper alignment
  const max_option_length = Math.max(
    ...option_names.map((name) => name.length)
  );

  // Add help option (always present)
  options.push({
    name: "--help",
    description: "Show help",
  });

  for (const key of sortedKeys) {
    const option = schema[key];
    const optionName = key.length === 1 ? `-${key}` : `--${key}`;
    const typeHint = option.type === "string" ? " <value>" : "";
    const displayName = `${optionName}${typeHint}`;
    const desc = option.description || "";

    options.push({
      name: displayName,
      description: desc,
    });
  }

  const optionsText = options
    .map(
      (opt) => `  ${opt.name.padEnd(max_option_length + 2)}${opt.description}`
    )
    .join("\n");

  return `
auto-release ${name} - ${description}

Usage:
  auto-release ${name} [options]

Options:
${optionsText}
`;
}

/**
 * Options for creating a CLI
 */
export interface CreateCliOptions {
  /**
   * Name of the CLI tool (e.g., "auto-release")
   */
  name: string;

  /**
   * Description of the CLI tool
   */
  description: string;

  /**
   * Commands available in the CLI
   */
  commands: Record<string, Command<any>>;

  /**
   * Default config file path
   */
  default_config_path?: string;
}

/**
 * Display help message
 */
function show_help(
  name: string,
  description: string,
  commands: Record<string, Command<any>>,
  command?: Command<any>
) {
  if (!command) {
    // Calculate max command name length for proper alignment
    const max_command_length = Math.max(
      ...Object.values(commands).map((cmd) => cmd.name.length)
    );

    const command_list = Object.values(commands)
      .map(
        (cmd) =>
          `  ${cmd.name.padEnd(max_command_length + 2)}${cmd.description}`
      )
      .join("\n");

    console.log(`
${name} - ${description}

Usage:
  ${name} <command> [options]

Commands:
${command_list}

Options:
  --config <path>    Path to config file (default: auto-release.config.ts)
  --help             Show help

Run '${name} <command> --help' for command-specific help.
`);
    return;
  }

  console.log(generate_help(command.name, command.description, command.schema));
}

/**
 * Create a CLI handler function
 */
export function create_cli(options: CreateCliOptions) {
  const {
    name,
    description,
    commands,
    default_config_path = "auto-release.config.ts",
  } = options;

  /**
   * Main CLI entry point
   */
  return async function run_cli() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
      show_help(name, description, commands);
      process.exit(0);
    }

    const command_name = args[0];
    const command = commands[command_name as keyof typeof commands];

    if (!command) {
      show_help(name, description, commands);
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
    }) as {
      values: {
        config?: string;
        help?: boolean;
        [key: string]: string | boolean | (string | boolean)[] | undefined;
      };
    };

    if (values.help) {
      show_help(name, description, commands, command);
      process.exit(0);
    }

    // Load config
    let config;
    try {
      config = await load_config(values.config || default_config_path);
    } catch (error: any) {
      log.error(`Failed to load config: ${error.message}`);
      cancel("Config loading failed");
      process.exit(1);
    }

    // Execute command
    const result = await command.run({ values: values as any, config });

    // Handle exit code based on result
    if (result.status === "error") {
      log.error(result.error);
      cancel("Command failed");
      process.exit(1);
    }

    if (result.status === "success") {
      // Success - command completed successfully
      // Message is already displayed by the command if needed
    }
  };
}
