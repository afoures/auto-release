import { describe, it, expect } from "vitest";
import {
  parse_change_filename,
  parse_change_markdown,
} from "../src/lib/changes.js";

describe("parse_change_filename", () => {
  it("should parse valid change filenames", () => {
    expect(parse_change_filename("major.add-feature.md")).toEqual({
      kind: "major",
      slug: "add-feature",
    });

    expect(parse_change_filename("patch.fix-bug-123.md")).toEqual({
      kind: "patch",
      slug: "fix-bug-123",
    });
  });

  it("should return null for invalid filenames", () => {
    expect(parse_change_filename("invalid.md")).toBeNull();
    expect(parse_change_filename("no-extension")).toBeNull();
    expect(parse_change_filename("too.many.parts.md")).toBeNull();
  });
});

describe("parse_change_markdown", () => {
  it("should parse simple title (no heading)", () => {
    const content = "Fix authentication bug";
    const result = parse_change_markdown(content);
    expect(result).toEqual({
      title: "Fix authentication bug",
      description: [],
    });
  });

  it("should parse heading title with body", () => {
    const content = `# Add user profile page

This adds a new user profile page with avatar support.

Users can now customize their profiles.`;
    const result = parse_change_markdown(content);
    expect(result).toEqual({
      title: "Add user profile page",
      description: [
        "",
        "This adds a new user profile page with avatar support.",
        "",
        "Users can now customize their profiles.",
      ],
    });
  });

  it("should parse heading with multiple # symbols", () => {
    const content = "## Fix bug\n\nDetails here";
    const result = parse_change_markdown(content);
    expect(result).toEqual({
      title: "Fix bug",
      description: ["", "Details here"],
    });
  });

  it("should handle multi-line non-heading content", () => {
    const content = "Simple title\nBody line 1\nBody line 2";
    const result = parse_change_markdown(content);
    expect(result).toEqual({
      title: "Simple title",
      description: ["Body line 1", "Body line 2"],
    });
  });

  it("should throw on empty content", () => {
    expect(() => parse_change_markdown("")).toThrow("Change file is empty");
    expect(() => parse_change_markdown("   \n\n  ")).toThrow(
      "Change file is empty"
    );
  });
});
