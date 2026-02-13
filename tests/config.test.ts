import { isAbsolute, join, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { define_config } from "../src/lib/config.ts";
import { semver } from "../src/lib/versioning/semantic.ts";
import { github } from "../src/lib/platforms/github.ts";
import { node } from "../src/lib/components/node.ts";
import type { Formatter, VersionManager } from "../src/lib/types.ts";

describe("define_config", () => {
  it("should return config as-is", () => {
    const config = define_config({
      projects: {
        "my-app": {
          components: [node("packages/app")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
        },
      },
      git: {
        platform: github({ token: "test", owner: "test", repo: "test" }),
        target_branch: "main",
      },
    });
    config.path = join(process.cwd(), "config.ts");

    const managed_projects = config.managed_projects;

    expect(managed_projects).toHaveLength(1);
    const managed_app = managed_projects.find((item) => item.name === "my-app");
    expect(managed_app).toBeDefined();
  });

  it("resolves relative paths to absolute locations", () => {
    const config = define_config({
      changes_dir: ".changes",
      projects: {
        "my-app": {
          components: [node(".")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
        },
      },
      git: {
        platform: github({ token: "test", owner: "test", repo: "test" }),
        target_branch: "main",
      },
    });
    config.path = join(process.cwd(), "config.ts");

    const managed_project = config.managed_projects.find((item) => item.name === "my-app");

    expect(managed_project).toBeDefined();
    const resolved_project = managed_project!;

    expect(config.changes_dir).toBe(resolve(process.cwd(), ".changes"));

    const component_result = resolved_project.components[0];
    expect(isAbsolute(component_result.root)).toBe(true);
    expect(component_result.parts.every((part) => isAbsolute(part.file))).toBe(true);
  });

  it("should support custom strategies", () => {
    const formatter: Formatter<"breaking" | "feature" | "fix"> = {
      transform_markdown: () => ({
        releases: [],
      }),
      format_changelog: () => "",
      generate_release_notes: () => "[View Changelog](CHANGELOG.md)",
      generate_pr_body: () => "",
    };

    const custom_strategy: VersionManager<"breaking" | "feature" | "fix"> = {
      allowed_changes: ["breaking", "feature", "fix"] as const,
      compare: () => 0,
      validate: () => true,
      bump: () => "1.0.0",
      initial_version: "1.0.0",
      formatter,
      display_map: {
        breaking: { singular: "breaking change", plural: "breaking changes" },
        feature: { singular: "feature", plural: "features" },
        fix: { singular: "fix", plural: "fixes" },
      },
    };

    const config = define_config({
      projects: {
        "my-app": {
          components: [node("packages/app")],
          versioning: custom_strategy,
          changelog: "CHANGELOG.md",
        },
      },
      git: {
        platform: github({ token: "test", owner: "test", repo: "test" }),
        target_branch: "main",
      },
    });
    config.path = join(process.cwd(), "config.ts");

    const managed_app = config.managed_projects.find((item) => item.name === "my-app");

    expect(managed_app?.versioning.allowed_changes).toEqual(["breaking", "feature", "fix"]);
  });

  it("defaults release_group to project name", () => {
    const config = define_config({
      projects: {
        "my-app": {
          components: [node("packages/app")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
        },
      },
      git: {
        platform: github({ token: "test", owner: "test", repo: "test" }),
        target_branch: "main",
      },
    });
    config.path = join(process.cwd(), "config.ts");

    const managed_app = config.managed_projects.find((item) => item.name === "my-app");
    expect(managed_app?.release_group).toBe("my-app");
  });

  it("uses project-level release_group when specified", () => {
    const config = define_config({
      projects: {
        "my-app": {
          components: [node("packages/app")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
          release_group: "frontend",
        },
      },
      git: {
        platform: github({ token: "test", owner: "test", repo: "test" }),
        target_branch: "main",
      },
    });
    config.path = join(process.cwd(), "config.ts");

    const managed_app = config.managed_projects.find((item) => item.name === "my-app");
    expect(managed_app?.release_group).toBe("frontend");
  });

  it("uses default_project_config release_group when project has no release_group", () => {
    const config = define_config({
      default_project_config: {
        release_group: "shared",
      },
      projects: {
        "my-app": {
          components: [node("packages/app")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
        },
      },
      git: {
        platform: github({ token: "test", owner: "test", repo: "test" }),
        target_branch: "main",
      },
    });
    config.path = join(process.cwd(), "config.ts");

    const managed_app = config.managed_projects.find((item) => item.name === "my-app");
    expect(managed_app?.release_group).toBe("shared");
  });

  it("project-level release_group takes precedence over default_project_config", () => {
    const config = define_config({
      default_project_config: {
        release_group: "shared",
      },
      projects: {
        "my-app": {
          components: [node("packages/app")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
          release_group: "frontend",
        },
      },
      git: {
        platform: github({ token: "test", owner: "test", repo: "test" }),
        target_branch: "main",
      },
    });
    config.path = join(process.cwd(), "config.ts");

    const managed_app = config.managed_projects.find((item) => item.name === "my-app");
    expect(managed_app?.release_group).toBe("frontend");
  });

  it("defaults skip_release_if_no_change_file to false", () => {
    const config = define_config({
      projects: {
        "my-app": {
          components: [node("packages/app")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
        },
      },
      git: {
        platform: github({ token: "test", owner: "test", repo: "test" }),
        target_branch: "main",
      },
    });
    config.path = join(process.cwd(), "config.ts");

    const managed_app = config.managed_projects.find((item) => item.name === "my-app");
    expect(managed_app?.options.skip_release_if_no_change_file).toBe(false);
  });

  it("uses project-level skip_release_if_no_change_file option", () => {
    const config = define_config({
      projects: {
        "my-app": {
          components: [node("packages/app")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
          options: {
            skip_release_if_no_change_file: true,
          },
        },
      },
      git: {
        platform: github({ token: "test", owner: "test", repo: "test" }),
        target_branch: "main",
      },
    });
    config.path = join(process.cwd(), "config.ts");

    const managed_app = config.managed_projects.find((item) => item.name === "my-app");
    expect(managed_app?.options.skip_release_if_no_change_file).toBe(true);
  });

  it("uses default_project_config options when project has no options", () => {
    const config = define_config({
      default_project_config: {
        options: {
          skip_release_if_no_change_file: true,
        },
      },
      projects: {
        "my-app": {
          components: [node("packages/app")],
          versioning: semver(),
          changelog: "CHANGELOG.md",
        },
      },
      git: {
        platform: github({ token: "test", owner: "test", repo: "test" }),
        target_branch: "main",
      },
    });
    config.path = join(process.cwd(), "config.ts");

    const managed_app = config.managed_projects.find((item) => item.name === "my-app");
    expect(managed_app?.options.skip_release_if_no_change_file).toBe(true);
  });
});
