import type { Logger } from "../types.ts";

/**
 * Simple console logger implementation
 */
export function create_logger(silent: boolean = false): Logger {
  return {
    info(message: string) {
      if (!silent) console.log(message);
    },
    warn(message: string) {
      if (!silent) console.warn(`⚠️  ${message}`);
    },
    note(title: string, message: string) {
      if (silent) return;

      const line_length = Math.max(
        80,
        title.length + 10,
        ...message.split("\n").map((line) => line.length + 4),
      );
      const title_padding = "─".repeat(line_length - 10 - title.length);

      console.log(`╭──── ${title} ${title_padding}──╮`);
      console.log(
        message
          .split("\n")
          .map((line) => `│ ${line}${" ".repeat(line_length - line.length - 4)} │`)
          .join("\n"),
      );
      console.log(`╰${"─".repeat(line_length - 2)}╯`);
    },
    error(message: string) {
      if (!silent) console.error(`❌ ${message}`);
    },
    success(message: string) {
      if (!silent) console.log(`✅ ${message}`);
    },
  };
}
