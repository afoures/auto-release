import { isAbsolute, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { define_config } from "../src/lib/config.js";
import { semver } from "../src/lib/versioning/semantic.js";
import { github } from "../src/lib/providers/github.js";
import { node } from "../src/lib/components/node.js";
import type { Formatter, VersionManager } from "../src/lib/types.js";

describe("define_config", () => {
  it("should return config as-is", () => {
    const config = define_config({
      apps: {
        "my-app": {
          components: [node("packages/app")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
        },
      },
      git: {
        provider: github({ token: "test", owner: "test", repo: "test" }),
        default_target_branch: "main",
      },
    });

    const managed_apps = config.managed_applications;

    expect(managed_apps).toHaveLength(1);
    const managed_app = managed_apps.find((item) => item.name === "my-app");
    expect(managed_app).toBeDefined();
  });

  it("resolves relative paths to absolute locations", () => {
    const config = define_config({
      changes_dir: ".changes",
      apps: {
        "my-app": {
          components: [node(".")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
        },
      },
      git: {
        provider: github({ token: "test", owner: "test", repo: "test" }),
        default_target_branch: "main",
      },
    });

    const managed_app = config.managed_applications.find((item) => item.name === "my-app");

    expect(managed_app).toBeDefined();
    const resolved_app = managed_app!;

    expect(config.changes_dir).toBe(resolve(process.cwd(), ".changes"));

    const component_result = resolved_app.components[0];
    expect(isAbsolute(component_result.path)).toBe(true);
    expect(component_result.parts.every((part) => isAbsolute(part.path))).toBe(true);
  });

  it("should support custom strategies", () => {
    const formatter: Formatter<"breaking" | "feature" | "fix"> = {
      transform_markdown: () => ({
        releases: [],
      }),
      format_changelog: () => "",
      generate_release_notes: () => "",
      generate_pr_body: () => "",
    };

    const custom_strategy: VersionManager<"breaking" | "feature" | "fix"> = {
      allowed_changes: ["breaking", "feature", "fix"] as const,
      compare: () => 0,
      validate: () => true,
      bump: () => "1.0.0",
      formatter,
      display_map: {
        breaking: { singular: "breaking change", plural: "breaking changes" },
        feature: { singular: "feature", plural: "features" },
        fix: { singular: "fix", plural: "fixes" },
      },
    };

    const config = define_config({
      apps: {
        "my-app": {
          components: [node("packages/app")],
          versioning: custom_strategy,
          changelog: "CHANGELOG.md",
        },
      },
      git: {
        provider: github({ token: "test", owner: "test", repo: "test" }),
        default_target_branch: "main",
      },
    });

    const managed_app = config.managed_applications.find((item) => item.name === "my-app");

    expect(managed_app?.versioning.allowed_changes).toEqual(["breaking", "feature", "fix"]);
  });
});
