import { describe, it, expect } from "vitest";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import { default_formatter } from "../src/lib/formatter.ts";
import { ChangeFile } from "../src/lib/change-file.ts";

describe("default formatter", () => {
  const formatter = default_formatter({
    allowed_changes: ["major", "minor", "patch"],
    display_map: {
      major: { singular: "Breaking Change", plural: "Breaking Changes" },
      minor: { singular: "Feature", plural: "Features" },
      patch: { singular: "Bug Fix", plural: "Bug Fixes" },
    },
  });

  it("formats grouped changelog sections without dates", () => {
    const changelog = {
      root: { title: "test-app", description: [] as string[] },
      releases: [
        {
          version: "2.0.0",
          changes: [
            new ChangeFile({ kind: "major", summary: "Breaking API change" }),
            new ChangeFile({ kind: "minor", summary: "Add new feature" }),
            new ChangeFile({ kind: "patch", summary: "Fix bug" }),
          ],
        },
      ],
    };

    const output = formatter.format_changelog(changelog, {
      project: { name: "test-app" },
    });

    expect(output).toContain("## 2.0.0");
    expect(output).toContain("### Breaking Changes");
    expect(output).toContain("### Features");
    expect(output).toContain("### Bug Fixes");
    expect(output).not.toMatch(/\(/); // no date fragments
  });

  it("parses existing markdown and keeps root title", () => {
    const markdown = `# test-app\n\n## 1.0.0\n\n- Initial release`;
    const parsed = formatter.transform_markdown(
      fromMarkdown(markdown, {
        extensions: [gfm()],
        mdastExtensions: [gfmFromMarkdown()],
      }),
      markdown,
    );

    expect(parsed.root.title).toBe("# test-app");
    expect(parsed.releases[0]?.version).toBe("1.0.0");
    expect(parsed.releases[0]?.changes[0]?.summary).toContain("- Initial release");
  });

  it("creates release notes with link to changelog", () => {
    const notes = formatter.generate_release_notes({
      project: { name: "test-app", changelog: "CHANGELOG.md" },
      version: "1.1.0",
    });

    expect(notes).toBe("See the changelog for release notes: [test-app@1.1.0](CHANGELOG.md#110)");
  });

  it("adds no changes message when release has no changes", () => {
    const changelog = {
      root: { title: "test-app", description: [] as string[] },
      releases: [
        {
          version: "1.0.0",
          changes: [],
        },
      ],
    };

    const output = formatter.format_changelog(changelog, {
      project: { name: "test-app" },
    });

    expect(output).toContain("## 1.0.0");
    expect(output).toContain("No changes in this release.");
  });
});
