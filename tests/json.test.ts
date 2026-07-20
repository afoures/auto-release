import { describe, it, expect } from "vitest";
import { get_json_version, update_json_version } from "../src/lib/utils/json.ts";

describe("get_json_version", () => {
  it("reads the version field", () => {
    expect(get_json_version(`{\n  "version": "1.2.3"\n}\n`)).toBe("1.2.3");
  });
});

describe("update_json_version", () => {
  it("preserves 2-space indentation", () => {
    const input = `{\n  "name": "pkg",\n  "version": "1.0.0"\n}\n`;
    expect(update_json_version(input, "2.0.0")).toBe(
      `{\n  "name": "pkg",\n  "version": "2.0.0"\n}\n`,
    );
  });

  it("preserves 4-space indentation", () => {
    const input = `{\n    "name": "pkg",\n    "version": "1.0.0"\n}\n`;
    expect(update_json_version(input, "2.0.0")).toBe(
      `{\n    "name": "pkg",\n    "version": "2.0.0"\n}\n`,
    );
  });

  it("preserves tab indentation", () => {
    const input = `{\n\t"name": "pkg",\n\t"version": "1.0.0"\n}\n`;
    expect(update_json_version(input, "2.0.0")).toBe(
      `{\n\t"name": "pkg",\n\t"version": "2.0.0"\n}\n`,
    );
  });

  it("falls back to 2 spaces for minified input", () => {
    const input = `{"name":"pkg","version":"1.0.0"}`;
    expect(update_json_version(input, "2.0.0")).toBe(
      `{\n  "name": "pkg",\n  "version": "2.0.0"\n}`,
    );
  });

  it("preserves a trailing newline when present", () => {
    const input = `{\n  "version": "1.0.0"\n}\n`;
    expect(update_json_version(input, "2.0.0").endsWith("}\n")).toBe(true);
  });

  it("does not add a trailing newline when absent", () => {
    const input = `{\n  "version": "1.0.0"\n}`;
    expect(update_json_version(input, "2.0.0").endsWith("}")).toBe(true);
  });

  it("preserves key order and only mutates version", () => {
    const input = `{\n  "name": "pkg",\n  "version": "1.0.0",\n  "private": true\n}\n`;
    expect(update_json_version(input, "2.0.0")).toBe(
      `{\n  "name": "pkg",\n  "version": "2.0.0",\n  "private": true\n}\n`,
    );
  });
});
