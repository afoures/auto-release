import { regex } from "arkregex";
import { basename, dirname, join } from "node:path";
import * as fs from "./utils/fs.ts";
import human_id from "human-id";

const CHANGE_FILENAME_REGEX = regex("^(?<kind>[a-z0-9-]+)\\.(?<slug>[a-z0-9-]+)\\.md$");

export class ChangeFile<kind extends string> {
  #kind: kind;
  #slug: string;
  #folder: string | null;
  #summary: string;

  constructor(props: { kind: kind; slug?: string; folder?: string | null; summary: string }) {
    this.#kind = props.kind;
    this.#slug =
      props.slug ??
      human_id({
        separator: "-",
        capitalize: false,
      });
    this.#folder = props.folder ?? null;
    this.#summary = props.summary;
  }

  static async from_file<kind extends string>(path: string): Promise<ChangeFile<kind> | Error> {
    const folder = dirname(path);
    const filename = basename(path);
    const match = CHANGE_FILENAME_REGEX.exec(filename);
    if (!match) {
      return new Error(`Invalid change filename format: ${path} (expected: <kind>.<slug>.md)`);
    }
    const content = await fs.read_file(path);
    const lines = content.split("\n");
    const non_empty_lines = lines.filter((line) => line.trim() !== "");

    if (non_empty_lines.length === 0) {
      return new Error("Change file is empty");
    }

    const first_line = non_empty_lines[0].trim();

    // Remove # if present (for backward compatibility)
    const summary = first_line.startsWith("#")
      ? first_line.replace(/^#+\s*/, "").trim()
      : first_line;

    return new ChangeFile<kind>({
      kind: match.groups.kind as kind,
      slug: match.groups.slug as string,
      folder: folder,
      summary: summary,
    });
  }

  get kind(): kind {
    return this.#kind;
  }

  get summary(): string {
    return this.#summary;
  }

  get filename(): string {
    return `${this.#kind}.${this.#slug}.md`;
  }

  async save(to?: string): Promise<string> {
    const folder = to ?? this.#folder;
    if (folder === null) throw new Error("Folder is required");

    const file_path = join(folder, this.filename);

    await fs.write_file(file_path, `${this.#summary}\n`);

    return file_path;
  }
}
