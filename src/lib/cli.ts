import { parseArgs } from "node:util";
import type { ParseArgsOptionsType } from "node:util";
import { log, cancel, outro } from "@clack/prompts";
import type { Pretty } from "./types";

type CustomOption<type extends ParseArgsOptionsType> = {
  type: type;
  description?: string;
  short?: string;
} & ({ multiple: true; default?: Value<type>[] } | { multiple?: false; default?: Value<type> });

type Value<type extends ParseArgsOptionsType> = type extends "string"
  ? string
  : type extends "boolean"
    ? boolean
    : never;

type extract_value<option extends CustomOption<any>> = option extends { multiple: true }
  ? Value<option["type"]>[]
  : Value<option["type"]>;

type has_default<option extends CustomOption<any>> = option extends { default: any } ? true : false;

/**
 * Command definition interface
 */
type ParsedCommandArgs<args extends Record<string, CustomOption<any>>> = Pretty<{
  -readonly [key in keyof args]:
    | extract_value<args[key]>
    | (has_default<args[key]> extends true ? never : undefined);
}>;

type CommandGetContextArgs<args extends Record<string, CustomOption<any>>> = Pretty<{
  args: ParsedCommandArgs<args>;
  positionals: string[];
  cwd: string;
}>;

type CommandRunContext<
  args extends Record<string, CustomOption<any>>,
  context extends Record<string, unknown> = Record<string, unknown>,
> = Pretty<{
  args: ParsedCommandArgs<args>;
  positionals: string[];
  context: context;
}>;

export interface Command<
  args extends Record<string, CustomOption<any>>,
  context extends Record<string, unknown>,
> {
  /**
   * Command name (e.g., "check", "record")
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
  run: (
    args: CommandRunContext<NoInfer<args>, NoInfer<context>>,
  ) => Promise<{ status: "success"; message?: string } | { status: "error"; error: string }>;
  /**
   * Build the execution context (loads config, resolves root, etc.)
   */
  get_context: (args: CommandGetContextArgs<NoInfer<args>>) => Promise<context>;
}

/**
 * Command helper function
 */
export function create_command<
  const args extends Record<string, CustomOption<any>>,
  const context extends Record<string, unknown> = never,
>(command: Command<args, context>): typeof command {
  return command;
}

/**
 * Generate help text from command metadata and schema
 */
export function generate_help(
  name: string,
  description: string,
  schema: Record<string, CustomOption<any>>,
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
  const max_option_length = Math.max(...option_names.map((name) => name.length));

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
    .map((opt) => `  ${opt.name.padEnd(max_option_length + 2)}${opt.description}`)
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
  commands: Record<string, Command<any, any>>;
}

/**
 * Display help message
 */
function show_help(
  name: string,
  description: string,
  commands: Record<string, Command<any, any>>,
  command?: Command<any, any>,
) {
  if (!command) {
    // Calculate max command name length for proper alignment
    const max_command_length = Math.max(...Object.values(commands).map((cmd) => cmd.name.length));

    const command_list = Object.values(commands)
      .map((cmd) => `  ${cmd.name.padEnd(max_command_length + 2)}${cmd.description}`)
      .join("\n");

    console.log(`
${name} - ${description}

Usage:
  ${name} <command> [options]

Commands:
${command_list}

Options:
  --config <path>    Path to config file (default: search auto-release.config.{ts,js} upward to .git)
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
  const { name, description, commands } = options;

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
    const { values, positionals } = parseArgs({
      args: args.slice(1),
      options: {
        ...command.schema,
        config: { type: "string" as const },
        help: { type: "boolean" as const },
      },
      allowPositionals: true,
    }) as {
      values: ParsedCommandArgs<typeof command.schema> & { help?: boolean };
      positionals: string[];
    };

    if (values.help) {
      show_help(name, description, commands, command);
      process.exit(0);
    }

    try {
      const command_context = await command.get_context({
        args: values,
        positionals,
        cwd: process.cwd(),
      });
      const run_args: CommandRunContext<any, any> = {
        args: values,
        positionals,
        context: command_context,
      };

      // Execute command
      const result = await command.run(run_args);

      // Handle exit code based on result
      if (result.status === "error") {
        log.error(result.error);
        cancel("Command failed");
        process.exit(1);
      }

      if (result.status === "success") {
        // Success - command completed successfully
        // Message is already displayed by the command if needed
        outro(result.message ?? "Command completed successfully");
      }
    } catch (error: any) {
      log.error(`Failed to run command: ${error.message}`);
      cancel("Command execution failed");
      process.exit(1);
    }
  };
}
