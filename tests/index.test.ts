import { describe, it, expect } from "vitest";
import { define_config } from "../src/index.js";
import { semver } from "../src/versioning/semver.js";
import { calver } from "../src/versioning/calver.js";

describe("Public API exports", () => {
  it("should export define_config helper", () => {
    expect(typeof define_config).toBe("function");
  });

  it("should export semver factory function from versioning subpath", () => {
    expect(typeof semver).toBe("function");
    const strategy = semver();
    expect(strategy.change_types).toEqual(["major", "minor", "patch", "none"]);
    expect(typeof strategy.bump).toBe("function");
  });

  it("should export calver factory function from versioning subpath", () => {
    expect(typeof calver).toBe("function");
    const strategy = calver();
    expect(strategy.change_types).toEqual(["feature", "fix", "none"]);
    expect(typeof strategy.bump).toBe("function");
  });

  it("should allow defining a config with strategy", () => {
    const config = define_config({
      apps: [
        {
          name: "test-app",
          packages: ["./packages/test"],
          versioning: semver(),
        },
      ],
    });

    expect(config.apps).toHaveLength(1);
    expect(config.apps[0].name).toBe("test-app");
    expect(config.apps[0].versioning.change_types).toEqual([
      "major",
      "minor",
      "patch",
      "none",
    ]);
  });
});
