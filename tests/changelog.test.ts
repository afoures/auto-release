import { describe, it, expect } from "vitest";
import { semver } from "../src/lib/versioning/semantic.ts";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";

describe("default formatter", () => {
  const formatter = semver().formatter;

  it("formats grouped changelog sections without dates", () => {
    const changelog = {
      root: { title: "test-app", description: [] as string[] },
      releases: [
        {
          version: "2.0.0",
          changes: [
            { kind: "major", title: "Breaking API change", description: [] },
            { kind: "minor", title: "Add new feature", description: [] },
            { kind: "patch", title: "Fix bug", description: [] },
          ],
        },
      ],
    };

    const output = formatter.format_changelog(changelog, {
      app: { name: "test-app" },
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
    );

    expect(parsed.root.title).toBe("test-app");
    expect(parsed.releases[0]?.version).toBe("1.0.0");
    expect(parsed.releases[0]?.changes[0]?.title).toContain("Initial release");
  });

  it("creates release notes with link to changelog", () => {
    const notes = formatter.generate_release_notes({
      app: { name: "test-app", changelog: "CHANGELOG.md" },
      version: "1.1.0",
    });

    expect(notes).toBe("[View Changelog](CHANGELOG.md)");
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
      app: { name: "test-app" },
    });

    expect(output).toContain("## 1.0.0");
    expect(output).toContain("No changes in this release.");
  });
});
