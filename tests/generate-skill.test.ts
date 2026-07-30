import { describe, expect, it } from "vitest";
import { define_config } from "../src/lib/config.ts";
import { semver } from "../src/lib/versioning/semantic.ts";
import { node } from "../src/lib/components/node.ts";
import { github } from "../src/lib/platforms/github.ts";
import {
  extract_custom_section,
  generate_skill_source,
} from "../src/lib/commands/generate-skill.ts";

function make_config() {
  const config = define_config({
    projects: {
      "web-app": {
        components: [node("apps/web")],
        versioning: semver(),
        changelog: "apps/web/CHANGELOG.md",
      },
    },
    git: {
      platform: github({ owner: "acme", repo: "web", token: "test" }),
    },
  });
  // `folder`/`changes_dir` derive from `path`; set it so relative paths resolve.
  config.path = "/repo/auto-release.config.ts";
  return config;
}

describe("generate_skill_source", () => {
  it("emits Claude Code frontmatter", () => {
    const source = generate_skill_source(make_config());
    expect(source.startsWith("---\nname: auto-release\n")).toBe(true);
    expect(source).toContain("description:");
  });

  it("lists each managed project with its allowed change types", () => {
    const source = generate_skill_source(make_config());
    expect(source).toContain("`web-app`");
    expect(source).toContain("`major`");
    expect(source).toContain("`minor`");
    expect(source).toContain("`patch`");
  });

  it("includes an editable change-file format section that does not force a leading dash", () => {
    const source = generate_skill_source(make_config());
    expect(source).toContain("## Change file format");
    expect(source).toContain("Maintainers: edit the section between the markers below");
    expect(source).toContain("Do **not** assume a leading `- ` is required");
  });

  it("wraps the customisable section in preserve markers", () => {
    const source = generate_skill_source(make_config());
    expect(source).toContain("<!-- auto-release:custom:start -->");
    expect(source).toContain("<!-- auto-release:custom:end -->");
  });

  it("injects a preserved custom section in place of the default", () => {
    const source = generate_skill_source(make_config(), {
      custom_section: "House style: imperative mood, one line.",
    });
    expect(source).toContain("House style: imperative mood, one line.");
    expect(source).not.toContain("Do **not** assume a leading `- ` is required");
  });
});

describe("extract_custom_section", () => {
  it("round-trips the custom section through a regeneration", () => {
    const config = make_config();
    const customised = generate_skill_source(config).replace(
      /(<!-- auto-release:custom:start -->\n)[\s\S]*?(\n<!-- auto-release:custom:end -->)/,
      "$1Always mention the affected screen.$2",
    );

    const custom_section = extract_custom_section(customised);
    expect(custom_section).toBe("Always mention the affected screen.");

    const regenerated = generate_skill_source(config, { custom_section });
    expect(regenerated).toContain("Always mention the affected screen.");
    // The generated shell is refreshed, not duplicated.
    expect(regenerated.match(/## Change file format/g)).toHaveLength(1);
    expect(regenerated.match(/auto-release:custom:start/g)).toHaveLength(1);
  });

  it("falls back to the section body for files generated before the markers existed", () => {
    const legacy = [
      "---",
      "name: auto-release",
      "---",
      "",
      "## Change file format",
      "",
      "<!-- Maintainers: edit this section to describe your repo's preferred change-file style.",
      "     The agent will follow whatever you write here. -->",
      "",
      "Our style: past tense, always link the issue.",
      "",
      "## Verify",
      "",
      "```bash",
      "auto-release check",
      "```",
      "",
    ].join("\n");

    expect(extract_custom_section(legacy)).toBe("Our style: past tense, always link the issue.");
  });

  it("returns null when there is nothing to preserve", () => {
    expect(extract_custom_section("# Some unrelated file\n")).toBeNull();
    expect(
      extract_custom_section("<!-- auto-release:custom:start -->\n\n<!-- auto-release:custom:end -->"),
    ).toBeNull();
  });

  it("embeds the change-file directory", () => {
    const source = generate_skill_source(make_config());
    expect(source).toContain(".changes/<project>/");
  });
});
