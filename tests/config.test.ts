import { describe, it, expect } from "vitest";
import { define_config } from "../src/lib/config.js";
import { semver } from "../src/lib/versioning/semantic.js";
import { github } from "../src/lib/providers/github.js";
import { node } from "../src/lib/components/node.js";

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

    expect(Object.keys(config.apps)).toHaveLength(1);
    expect(config.apps["my-app"]).toBeDefined();
  });

  it("should support custom strategies", () => {
    const custom_strategy = {
      allowed_changes: ["breaking", "feature", "fix"] as const,
      compare: () => 0 as const,
      validate: () => true,
      bump: () => "1.0.0",
      formatter: {} as any,
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

    expect(config.apps["my-app"].versioning.allowed_changes).toEqual([
      "breaking",
      "feature",
      "fix",
    ]);
  });
});
