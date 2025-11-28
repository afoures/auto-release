import { describe, it, expect } from "vitest";
import { define_config } from "../src/lib/config.js";
import { semver } from "../src/semantic-versioning.js";

describe("define_config", () => {
  it("should return config as-is", () => {
    const config = define_config({
      apps: [
        {
          name: "my-app",
          packages: ["packages/app"],
          versioning: semver(),
          changelog: {
            path: "CHANGELOG.md",
          },
        },
      ],
      git: {} as any,
    });

    expect(config.apps).toHaveLength(1);
    expect(config.apps[0].name).toBe("my-app");
  });

  it("should support custom strategies", () => {
    const custom_strategy = {
      change_types: ["breaking", "feature", "fix"] as const,
      bump: () => "1.0.0",
    };

    const config = define_config({
      apps: [
        {
          name: "my-app",
          packages: ["packages/app"],
          versioning: custom_strategy,
          changelog: {
            path: "CHANGELOG.md",
          },
        },
      ],
      git: {} as any,
    });

    expect(config.apps[0].versioning.change_types).toEqual([
      "breaking",
      "feature",
      "fix",
    ]);
  });
});
