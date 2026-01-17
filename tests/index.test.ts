import { describe, it, expect } from "vitest";
import { define_config } from "../src/index.ts";
import { semver } from "../src/lib/versioning/semantic.ts";
import { calver } from "../src/lib/versioning/calendar.ts";
import { github } from "../src/lib/platforms/github.ts";
import { node } from "../src/lib/components/node.ts";
import { join } from "node:path";

describe("Public API exports", () => {
  it("should export define_config helper", () => {
    expect(typeof define_config).toBe("function");
  });

  it("should export semver factory function from versioning subpath", () => {
    expect(typeof semver).toBe("function");
    const strategy = semver();
    expect(strategy.allowed_changes).toEqual(["major", "minor", "patch"]);
    expect(typeof strategy.bump).toBe("function");
  });

  it("should export calver factory function from versioning subpath", () => {
    expect(typeof calver).toBe("function");
    const strategy = calver();
    expect(strategy.allowed_changes).toEqual(["feature", "fix"]);
    expect(typeof strategy.bump).toBe("function");
  });

  it("should allow defining a config with strategy", () => {
    const config = define_config({
      projects: {
        "test-app": {
          components: [node("./packages/test")],
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
    const managed_project = managed_projects.find((item) => item.name === "test-app");

    expect(managed_project).toBeDefined();
    expect(managed_project?.versioning.allowed_changes).toEqual(["major", "minor", "patch"]);
  });
});
