import { describe, expect, it } from "vitest";
import { define_config } from "../src/lib/config.ts";
import { semver } from "../src/lib/versioning/semantic.ts";
import { node } from "../src/lib/components/node.ts";
import { github } from "../src/lib/platforms/github.ts";
import { generate_skill_source } from "../src/lib/commands/generate-skill.ts";

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
    expect(source).toContain("Maintainers: edit this section");
    expect(source).toContain("Do **not** assume a leading `- ` is required");
  });

  it("embeds the change-file directory", () => {
    const source = generate_skill_source(make_config());
    expect(source).toContain(".changes/<project>/");
  });
});
