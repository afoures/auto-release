import type { ParseArgsOptionDescriptor } from "node:util";
import type { AutoReleaseConfig } from "../types.js";

/**
 * Extended option schema with description for help generation
 */
export interface Option extends ParseArgsOptionDescriptor {
  description?: string;
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

  // Add help option (always present)
  options.push({
    name: "--help".padEnd(20),
    description: "Show help",
  });

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
    const desc = option.description || "";

    options.push({
      name: displayName.padEnd(20),
      description: desc,
    });
  }

  const optionsText = options
    .map((opt) => `  ${opt.name}    ${opt.description}`)
    .join("\n");

  return `
auto-release ${name} - ${description}

Usage:
  auto-release ${name} [options]

Options:
${optionsText}
`;
}

type convert_to_values<args extends Record<string, Option>> = {
  [K in keyof args]: args[K]["type"] extends "string"
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
   * Command name (e.g., "validate", "change")
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
    config: AutoReleaseConfig;
  }) => Promise<
    | { ok: true; warnings?: string[] }
    | { ok: false; errors?: string[]; warnings?: string[] }
  >;
}

export function command<args extends Record<string, Option>>(
  command: Command<args>
): Command<args> {
  return command;
}
