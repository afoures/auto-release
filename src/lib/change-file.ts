import { regex } from "arkregex";
import { readFileSync } from "node:fs";

const CHANGE_FILENAME_REGEX = regex("^(?<kind>[a-z0-9-]+)\\.(?<slug>[a-z0-9-]+)\\.md$");

export function parse_change_markdown(content: string) {
  const lines = content.split("\n");
  const non_empty_lines = lines.filter((line) => line.trim() !== "");

  if (non_empty_lines.length === 0) {
    throw new Error("Change file is empty");
  }

  const first_line = non_empty_lines[0].trim();

  // Check if first line is a heading
  if (first_line.startsWith("#")) {
    const title = first_line.replace(/^#+\s*/, "").trim();
    const body_start_index = lines.findIndex((line) => line.trim() === first_line);
    const body_lines = lines.slice(body_start_index + 1);
    return {
      title,
      description: body_lines,
    };
  }

  // Simple title (first line)
  return {
    title: first_line,
    description: non_empty_lines.slice(1),
  };
}

export class ChangeFile<kind extends string> {
  #kind: kind;
  #filename: string | null;
  #summary: string;
  #details: string[];

  constructor(props: { kind: kind; summary: string; details: string[]; filename?: string | null }) {
    this.#kind = props.kind;
    this.#filename = props.filename ?? null;
    this.#summary = props.summary;
    this.#details = props.details;
  }

  static from_file<kind extends string>(path: string): ChangeFile<kind> | Error {
    const match = CHANGE_FILENAME_REGEX.exec(path);
    if (!match) {
      return new Error(`Invalid change filename format: ${path} (expected: <kind>.<slug>.md)`);
    }
    const content = readFileSync(path, "utf-8");
    const parsed_content = parse_change_markdown(content);
    return new ChangeFile<kind>({
      filename: path,
      kind: match.groups.kind as kind,
      summary: parsed_content.title,
      details: parsed_content.description,
    });
  }

  get kind(): kind {
    return this.#kind;
  }

  get filename(): string | null {
    return this.#filename;
  }

  get summary(): string {
    return this.#summary;
  }

  get details(): string[] {
    return this.#details;
  }
}
