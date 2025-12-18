import { regex } from "arkregex";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";
import human_id from "human-id";

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
  #slug: string;
  #folder: string | null;
  #summary: string;
  #details: string[];

  constructor(props: {
    kind: kind;
    slug?: string;
    folder?: string | null;
    summary: string;
    details: string[];
  }) {
    this.#kind = props.kind;
    this.#slug =
      props.slug ??
      human_id({
        separator: "-",
        capitalize: false,
      });
    this.#folder = props.folder ?? null;
    this.#summary = props.summary;
    this.#details = props.details;
  }

  static from_file<kind extends string>(path: string): ChangeFile<kind> | Error {
    const folder = dirname(path);
    const filename = basename(path);
    const match = CHANGE_FILENAME_REGEX.exec(filename);
    if (!match) {
      return new Error(`Invalid change filename format: ${path} (expected: <kind>.<slug>.md)`);
    }
    const content = readFileSync(path, "utf-8");
    const parsed_content = parse_change_markdown(content);
    return new ChangeFile<kind>({
      kind: match.groups.kind as kind,
      slug: match.groups.slug as string,
      folder: folder,
      summary: parsed_content.title,
      details: parsed_content.description,
    });
  }

  get kind(): kind {
    return this.#kind;
  }

  get summary(): string {
    return this.#summary;
  }

  get details(): string[] {
    return this.#details;
  }

  get file(): { filename: string; folder: string } | null {
    if (this.#folder === null) return null;
    return {
      filename: `${this.#kind}.${this.#slug}.md`,
      folder: this.#folder,
    };
  }

  async save(folder?: string): Promise<string> {
    this.#folder = folder ?? this.#folder;
    const file = this.file;
    if (file === null) throw new Error("File is required");

    await mkdir(file.folder, { recursive: true });

    // Generate content
    let content: string;
    if (this.#details.length > 0 && this.#details.some((line) => line.trim() !== "")) {
      content = `# ${this.#summary}\n\n${this.#details.join("\n")}\n`;
    } else {
      content = `${this.#summary}\n`;
    }

    await writeFile(join(file.folder, file.filename), content, "utf-8");

    return join(file.folder, file.filename);
  }
}
