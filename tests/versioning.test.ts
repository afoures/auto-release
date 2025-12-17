import { describe, it, expect } from "vitest";
import { semver } from "../src/lib/versioning/semantic.js";
import { calver } from "../src/lib/versioning/calendar.js";
import type { Change } from "../src/lib/versioning/types.js";

describe("semver", () => {
  it("should return a strategy with correct allowed_changes", () => {
    const strategy = semver();
    expect(strategy.allowed_changes).toEqual(["major", "minor", "patch"]);
  });

  it("should bump major version", () => {
    const strategy = semver();
    const changes: Change<"major" | "minor" | "patch">[] = [
      {
        kind: "major",
        title: "Breaking change",
        description: [],
      },
    ];
    const result = strategy.bump({
      version: "1.2.3",
      changes,
      date: new Date(),
    });
    expect(result).toBe("2.0.0");
  });

  it("should bump minor version", () => {
    const strategy = semver();
    const changes: Change<"major" | "minor" | "patch">[] = [
      {
        kind: "minor",
        title: "New feature",
        description: [],
      },
    ];
    const result = strategy.bump({
      version: "1.2.3",
      changes,
      date: new Date(),
    });
    expect(result).toBe("1.3.0");
  });

  it("should bump patch version", () => {
    const strategy = semver();
    const changes: Change<"major" | "minor" | "patch">[] = [
      {
        kind: "patch",
        title: "Bug fix",
        description: [],
      },
    ];
    const result = strategy.bump({
      version: "1.2.3",
      changes,
      date: new Date(),
    });
    expect(result).toBe("1.2.4");
  });

  it("should bump patch version when no changes", () => {
    const strategy = semver();
    const result = strategy.bump({
      version: "1.2.3",
      changes: [],
      date: new Date(),
    });
    // When no changes, defaults to patch bump
    expect(result).toBe("1.2.4");
  });

  it("should use highest precedence when multiple changes", () => {
    const strategy = semver();
    const changes: Change<"major" | "minor" | "patch">[] = [
      {
        kind: "patch",
        title: "Bug fix",
        description: [],
      },
      {
        kind: "major",
        title: "Breaking change",
        description: [],
      },
      {
        kind: "minor",
        title: "New feature",
        description: [],
      },
    ];
    const result = strategy.bump({
      version: "1.2.3",
      changes,
      date: new Date(),
    });
    expect(result).toBe("2.0.0");
  });

  it("should throw on invalid semver", () => {
    const strategy = semver();
    expect(() =>
      strategy.bump({
        version: "1.2",
        changes: [
          {
            kind: "patch",
            title: "fix",
            description: [],
          },
        ],
        date: new Date(),
      }),
    ).toThrow("Invalid semantic version");
  });
});

describe("calver", () => {
  it("should return a strategy with correct allowed_changes", () => {
    const strategy = calver();
    expect(strategy.allowed_changes).toEqual(["feature", "fix"]);
  });

  it("should increment minor when same year", () => {
    const strategy = calver();
    const changes: Change<"feature" | "fix">[] = [
      {
        kind: "feature",
        title: "New feature",
        description: [],
      },
    ];
    const result = strategy.bump({
      version: "2025.1.0",
      changes,
      date: new Date("2025-11-26"),
    });
    expect(result).toBe("2025.2.0");
  });

  it("should reset when different year", () => {
    const strategy = calver();
    const changes: Change<"feature" | "fix">[] = [
      {
        kind: "feature",
        title: "New feature",
        description: [],
      },
    ];
    const result = strategy.bump({
      version: "2025.5.0",
      changes,
      date: new Date("2026-01-01"),
    });
    expect(result).toBe("2026.1.0");
  });

  it("should bump patch version when no changes", () => {
    const strategy = calver();
    const result = strategy.bump({
      version: "2025.1.0",
      changes: [],
      date: new Date("2025-11-26"),
    });
    // When no changes, defaults to fix (patch) bump
    expect(result).toBe("2025.1.1");
  });

  it("should throw on invalid calver", () => {
    const strategy = calver();
    // Invalid version format will cause parse() to throw
    expect(() =>
      strategy.bump({
        version: "invalid-version",
        changes: [
          {
            kind: "feature",
            title: "feat",
            description: [],
          },
        ],
        date: new Date(),
      }),
    ).toThrow("Invalid calendar version");
  });
});
