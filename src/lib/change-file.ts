import { regex } from "arkregex";
import { basename, join } from "node:path";
import * as fs from "./utils/fs.ts";
import { humanId as human_id } from "human-id";

const CHANGE_FILENAME_REGEX = regex(
  "^(?<kind>[a-z0-9-]+)\\.(?:(?<index>\\d+)-)?(?<slug>[a-z0-9-]+)\\.md$",
);

export class ChangeFile<kind extends string> {
  #kind: kind;
  #index: number;
  #slug: string;
  #summary: string;
  #birthtime: Date;

  constructor(props: {
    kind: kind;
    index?: number;
    slug?: string;
    summary: string;
    birthtime?: Date;
  }) {
    this.#kind = props.kind;
    this.#index = props.index ?? 1;
    this.#slug =
      props.slug ??
      human_id({
        separator: "-",
        capitalize: false,
      });
    this.#summary = props.summary;
    this.#birthtime = props.birthtime ?? new Date(0);
  }

  get kind(): kind {
    return this.#kind;
  }

  get index(): number {
    return this.#index;
  }

  get summary(): string {
    return this.#summary;
  }

  get filename(): string {
    return `${this.#kind}.${this.#index}-${this.#slug}.md`;
  }

  get birthtime(): Date {
    return this.#birthtime;
  }
}

export async function save_change_file<kind extends string>(
  change_file: ChangeFile<kind>,
  to: string,
): Promise<string> {
  const file_path = join(to, change_file.filename);
  const text = change_file.summary
    .split("\n")
    .map((line) => line.slice(2))
    .join("\n");
  await fs.write_file(file_path, text);
  return file_path;
}

export async function parse_change_file<kind extends string>(
  path: string,
): Promise<ChangeFile<kind> | Error> {
  const filename = basename(path);
  const match = CHANGE_FILENAME_REGEX.exec(filename);

  if (!match) {
    return new Error(
      `Invalid change filename format: ${path} (expected: <kind>.<index>-<slug>.md)`,
    );
  }

  let file_content = await fs.read_file(path);
  file_content = file_content?.trim() ?? null;
  if (file_content === null) {
    return new Error(`Change file is missing: ${path}`);
  }
  if (!file_content) {
    return new Error("Change file is empty");
  }

  const [title, ...rest] = file_content.split("\n");

  const text = [`- ${title}`, ...rest.map((line) => `  ${line}`)].join("\n");

  const index = match.groups.index ? parseInt(match.groups.index, 10) : 1;

  const birthtime = (await fs.get_file_stats(path))?.birthtime ?? new Date(0);

  return new ChangeFile<kind>({
    index,
    slug: match.groups.slug,
    kind: match.groups.kind as kind,
    summary: text,
    birthtime,
  });
}

export async function find_change_files<kind extends string>(
  folder: string,
  { allowed_kinds }: { allowed_kinds: readonly kind[] },
): Promise<{ list: ChangeFile<kind>[]; warnings: string[] }> {
  const files = await fs.list_files(folder, { sort: "name" });
  const list: ChangeFile<kind>[] = [];
  const warnings: string[] = [];

  for (const filename of files) {
    const file_path = join(folder, filename);
    const change_file_or_error = await parse_change_file<kind>(file_path);
    if (change_file_or_error instanceof Error) {
      warnings.push(`Change file ${file_path} is invalid: ${change_file_or_error.message}`);
      continue;
    }
    const change_file = change_file_or_error;
    if (!allowed_kinds.includes(change_file.kind)) {
      warnings.push(`Change file ${file_path} has an invalid kind: ${change_file.kind}`);
      continue;
    }
    list.push(change_file_or_error);
  }

  list.sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind.localeCompare(b.kind);
    }
    if (a.index !== b.index) {
      return a.index - b.index;
    }
    return a.birthtime.getTime() - b.birthtime.getTime();
  });

  return { list, warnings };
}
