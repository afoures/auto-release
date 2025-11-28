import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

/**
 * Prompt user for input
 */
export async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(question);
  rl.close();
  return answer;
}

/**
 * Prompt user to select from a list of choices
 */
export async function select<T extends string>(
  question: string,
  choices: readonly T[]
): Promise<T> {
  console.log(question);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice}`);
  });

  const rl = readline.createInterface({ input, output });

  while (true) {
    const answer = await rl.question("Enter number: ");
    const index = parseInt(answer, 10) - 1;

    if (index >= 0 && index < choices.length) {
      rl.close();
      return choices[index];
    }

    console.log("Invalid choice, please try again.");
  }
}

/**
 * Prompt user for confirmation
 */
export async function confirm(
  question: string,
  default_value: boolean = false
): Promise<boolean> {
  const suffix = default_value ? " [Y/n]" : " [y/N]";
  const answer = await prompt(question + suffix);

  if (answer.trim() === "") {
    return default_value;
  }

  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
}

/**
 * Prompt for multi-line input (ends with empty line or EOF)
 */
export async function multiline(question: string): Promise<string> {
  console.log(question + " (end with empty line)");

  const rl = readline.createInterface({ input, output });
  const lines: string[] = [];

  for await (const line of rl) {
    if (line.trim() === "") {
      break;
    }
    lines.push(line);
  }

  rl.close();
  return lines.join("\n");
}
