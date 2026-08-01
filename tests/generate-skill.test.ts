import { describe, expect, it } from "vitest";
import { define_config } from "../src/lib/config.ts";
import { semver } from "../src/lib/versioning/semantic.ts";
import { node } from "../src/lib/components/node.ts";
import { github } from "../src/lib/platforms/github.ts";
import {
  compute_skill_drift,
  describe_skill_drift,
  generate_skill_source,
  skill_file_path,
  style_file_path,
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

  it("uses the least severe type in the example command", () => {
    const source = generate_skill_source(make_config());
    expect(source).toContain("--project web-app --type patch");
  });

  it("embeds the change-file directory", () => {
    const source = generate_skill_source(make_config());
    expect(source).toContain(".changes/<project>/");
  });

  it("delegates the change-file format to the sibling file instead of inlining it", () => {
    const source = generate_skill_source(make_config());
    expect(source).toContain("## Change file format");
    expect(source).toContain("`change-file-format.md`");
    // Nothing hand-maintained lives in the generated skill any more.
    expect(source).not.toContain("auto-release:custom");
  });

  it("tells the agent what to do when the embedded data is stale", () => {
    const source = generate_skill_source(make_config());
    expect(source).toContain("this file is stale");
  });

  it("is a pure function of the config, so it can be compared byte for byte", () => {
    expect(generate_skill_source(make_config())).toBe(generate_skill_source(make_config()));
  });
});

describe("path helpers", () => {
  it("places both files in a skill-named subfolder", () => {
    expect(skill_file_path("/repo/.claude/skills")).toBe(
      "/repo/.claude/skills/auto-release/SKILL.md",
    );
    expect(style_file_path("/repo/.claude/skills")).toBe(
      "/repo/.claude/skills/auto-release/change-file-format.md",
    );
  });
});

describe("compute_skill_drift", () => {
  const config = make_config();
  const current = generate_skill_source(config);

  it("reports a freshly generated pair as up to date", () => {
    const { status } = compute_skill_drift(config, { skill: current, style: "anything" });
    expect(status).toBe("up_to_date");
    expect(describe_skill_drift(status, "SKILL.md")).toBeNull();
  });

  it("reports a missing skill", () => {
    const { status } = compute_skill_drift(config, { skill: null, style: null });
    expect(status).toBe("missing");
    expect(describe_skill_drift(status, "SKILL.md")).toContain("generate-skill");
  });

  it("reports a skill that no longer matches the config", () => {
    const stale = current.replace("`web-app`", "`old-name`");
    const { status } = compute_skill_drift(config, { skill: stale, style: "anything" });
    expect(status).toBe("outdated");
  });

  it("never treats the maintainer-owned format file's content as drift", () => {
    const rewritten = compute_skill_drift(config, {
      skill: current,
      style: "Completely rewritten house style.",
    });
    expect(rewritten.status).toBe("up_to_date");
  });

  it("reports a deleted format file, since the skill links to it", () => {
    const { status } = compute_skill_drift(config, { skill: current, style: null });
    expect(status).toBe("style_missing");
    expect(describe_skill_drift(status, "SKILL.md")).toContain("change-file-format.md");
  });
});
