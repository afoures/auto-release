import { regex } from "arkregex";
import { basename, join } from "node:path";
import * as fs from "./utils/fs.ts";
import { humanId as human_id } from "human-id";

const CHANGE_FILENAME_REGEX = regex("^(?<kind>[a-z0-9-]+)\\.(?<slug>[a-z0-9-]+)\\.md$");

export class ChangeFile<kind extends string> {
  #kind: kind;
  #slug: string;
  #summary: string;

  constructor(props: { kind: kind; slug?: string; summary: string }) {
    this.#kind = props.kind;
    this.#slug =
      props.slug ??
      human_id({
        separator: "-",
        capitalize: false,
      });
    this.#summary = props.summary;
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
}

export async function save_change_file<kind extends string>(
  change_file: ChangeFile<kind>,
  to: string,
): Promise<string> {
  const file_path = join(to, change_file.filename);
  await fs.write_file(file_path, change_file.summary);
  return file_path;
}

export async function parse_change_file<kind extends string>(
  path: string,
): Promise<ChangeFile<kind> | Error> {
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
  const summary = first_line.startsWith("#") ? first_line.replace(/^#+\s*/, "").trim() : first_line;

  return new ChangeFile<kind>({ kind: match.groups.kind as kind, summary: summary });
}

export async function find_change_files<kind extends string>(
  folder: string,
  { allowed_kinds }: { allowed_kinds: readonly kind[] },
): Promise<{ list: ChangeFile<kind>[]; warnings: string[] }> {
  const files = await fs.list_files(folder);
  const list: ChangeFile<kind>[] = [];
  const warnings: string[] = [];
  for (const filename of files) {
    const file_path = join(folder, filename);
    console.log(file_path);
    const change_file_or_error = await parse_change_file<kind>(file_path);
    if (change_file_or_error instanceof Error) {
      continue;
    }
    const change_file = change_file_or_error;
    if (!allowed_kinds.includes(change_file.kind)) {
      warnings.push(`Change file ${file_path} has an invalid kind: ${change_file.kind}`);
      continue;
    }
    list.push(change_file_or_error);
  }
  return { list, warnings };
}
