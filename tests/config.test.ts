import { describe, it, expect } from "vitest";
import { define_config } from "../src/config.js";
import { semver } from "../src/versioning/semver.js";

describe("define_config", () => {
  it("should return config as-is", () => {
    const config = define_config({
      apps: [
        {
          name: "my-app",
          packages: ["packages/app"],
          versioning: semver(),
        },
      ],
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
        },
      ],
    });

    expect(config.apps[0].versioning.change_types).toEqual([
      "breaking",
      "feature",
      "fix",
    ]);
  });
});
