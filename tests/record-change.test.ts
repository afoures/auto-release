import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { derive_slug } from "../src/lib/commands/record-change.ts";
import { ChangeFile, parse_change_file, save_change_file } from "../src/lib/change-file.ts";

describe("derive_slug", () => {
  it("kebab-cases the first line only", () => {
    expect(derive_slug("Add a Feature\n\nbody text ignored")).toBe("add-a-feature");
  });

  it("normalizes special characters and underscores", () => {
    expect(derive_slug("Fix: the `weird` thing_name!")).toBe("fix-the-weird-thing-name");
  });

  it("caps long titles at 60 chars with no trailing hyphen", () => {
    const slug = derive_slug(
      "this is a very long change title that keeps going well beyond the sixty character cap",
    );
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("content round-trip through save/parse", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "auto-release-record-change-"));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes content verbatim and parses back to the same summary", async () => {
    const content = "Add a feature\n\nMore details here";
    const change_file = new ChangeFile({
      kind: "minor",
      index: 1,
      slug: derive_slug(content),
      summary: content,
    });

    const file_path = await save_change_file(change_file, dir);
    const parsed = await parse_change_file(file_path);

    expect(parsed).not.toBeInstanceOf(Error);
    if (parsed instanceof Error) return;
    expect(parsed.kind).toBe("minor");
    expect(parsed.summary).toBe(content);
  });

  it("preserves a user-supplied leading '- ' unchanged", async () => {
    const content = "- Add a feature\n\n  More details here";
    const change_file = new ChangeFile({
      kind: "minor",
      index: 2,
      slug: "add-a-feature",
      summary: content,
    });

    const file_path = await save_change_file(change_file, dir);
    const parsed = await parse_change_file(file_path);

    expect(parsed).not.toBeInstanceOf(Error);
    if (parsed instanceof Error) return;
    expect(parsed.summary).toBe(content);
  });
});
