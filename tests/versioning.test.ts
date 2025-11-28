import { describe, it, expect } from "vitest";
import { semver } from "../src/semantic-versioning.js";
import { calver } from "../src/calendar-versioning.js";
import type { ResolvedChange } from "../src/lib/types.js";

describe("semver", () => {
  it("should return a strategy with correct change_types", () => {
    const strategy = semver();
    expect(strategy.change_types).toEqual(["major", "minor", "patch", "none"]);
  });

  it("should bump major version", () => {
    const strategy = semver();
    const changes: ResolvedChange[] = [
      {
        app_name: "test",
        type: "major",
        title: "Breaking change",
        file_path: "/test.md",
      },
    ];
    const result = strategy.bump({
      current_version: "1.2.3",
      changes,
      time: { now: () => new Date() },
    });
    expect(result).toBe("2.0.0");
  });

  it("should bump minor version", () => {
    const strategy = semver();
    const changes: ResolvedChange[] = [
      {
        app_name: "test",
        type: "minor",
        title: "New feature",
        file_path: "/test.md",
      },
    ];
    const result = strategy.bump({
      current_version: "1.2.3",
      changes,
      time: { now: () => new Date() },
    });
    expect(result).toBe("1.3.0");
  });

  it("should bump patch version", () => {
    const strategy = semver();
    const changes: ResolvedChange[] = [
      {
        app_name: "test",
        type: "patch",
        title: "Bug fix",
        file_path: "/test.md",
      },
    ];
    const result = strategy.bump({
      current_version: "1.2.3",
      changes,
      time: { now: () => new Date() },
    });
    expect(result).toBe("1.2.4");
  });

  it('should not bump on "none" type', () => {
    const strategy = semver();
    const changes: ResolvedChange[] = [
      {
        app_name: "test",
        type: "none",
        title: "Documentation update",
        file_path: "/test.md",
      },
    ];
    const result = strategy.bump({
      current_version: "1.2.3",
      changes,
      time: { now: () => new Date() },
    });
    expect(result).toBe("1.2.3");
  });

  it("should use highest precedence when multiple changes", () => {
    const strategy = semver();
    const changes: ResolvedChange[] = [
      {
        app_name: "test",
        type: "patch",
        title: "Bug fix",
        file_path: "/test1.md",
      },
      {
        app_name: "test",
        type: "major",
        title: "Breaking change",
        file_path: "/test2.md",
      },
      {
        app_name: "test",
        type: "minor",
        title: "New feature",
        file_path: "/test3.md",
      },
    ];
    const result = strategy.bump({
      current_version: "1.2.3",
      changes,
      time: { now: () => new Date() },
    });
    expect(result).toBe("2.0.0");
  });

  it("should throw on invalid semver", () => {
    const strategy = semver();
    expect(() =>
      strategy.bump({
        current_version: "1.2",
        changes: [
          {
            app_name: "test",
            type: "patch",
            title: "fix",
            file_path: "/test.md",
          },
        ],
        time: { now: () => new Date() },
      })
    ).toThrow("Invalid semver version");
  });
});

describe("calver", () => {
  it("should return a strategy with correct change_types", () => {
    const strategy = calver();
    expect(strategy.change_types).toEqual(["feature", "fix", "none"]);
  });

  it("should increment micro when same month", () => {
    const strategy = calver();
    const changes: ResolvedChange[] = [
      {
        app_name: "test",
        type: "feature",
        title: "New feature",
        file_path: "/test.md",
      },
    ];
    const result = strategy.bump({
      current_version: "2025.11.0",
      changes,
      time: { now: () => new Date("2025-11-26") },
    });
    expect(result).toBe("2025.11.1");
  });

  it("should reset micro when different month", () => {
    const strategy = calver();
    const changes: ResolvedChange[] = [
      {
        app_name: "test",
        type: "feature",
        title: "New feature",
        file_path: "/test.md",
      },
    ];
    const result = strategy.bump({
      current_version: "2025.11.5",
      changes,
      time: { now: () => new Date("2025-12-01") },
    });
    expect(result).toBe("2025.12.0");
  });

  it("should return current version when no changes", () => {
    const strategy = calver();
    const result = strategy.bump({
      current_version: "2025.11.0",
      changes: [],
      time: { now: () => new Date("2025-11-26") },
    });
    expect(result).toBe("2025.11.0");
  });

  it("should throw on invalid calver", () => {
    const strategy = calver();
    expect(() =>
      strategy.bump({
        current_version: "2025-11-5",
        changes: [
          {
            app_name: "test",
            type: "feature",
            title: "feat",
            file_path: "/test.md",
          },
        ],
        time: { now: () => new Date() },
      })
    ).toThrow("Invalid calver version");
  });
});
