import { describe, it, expect } from "vitest";
import { semver } from "../src/lib/versioning/semantic.ts";
import { calver } from "../src/lib/versioning/calendar.ts";
import { markver } from "../src/lib/versioning/marketing.ts";
import { ChangeFile } from "../src/lib/change-file.ts";

describe("semver", () => {
  it("should return a strategy with correct allowed_changes", () => {
    const strategy = semver();
    expect(strategy.allowed_changes).toEqual(["major", "minor", "patch"]);
  });

  it("should bump major version", () => {
    const strategy = semver();
    const changes: ChangeFile<"major" | "minor" | "patch">[] = [
      new ChangeFile<"major" | "minor" | "patch">({
        kind: "major",
        slug: "breaking-change",
        summary: "Breaking change",
      }),
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
    const changes: ChangeFile<"major" | "minor" | "patch">[] = [
      new ChangeFile<"major" | "minor" | "patch">({
        kind: "minor",
        slug: "new-feature",
        summary: "New feature",
      }),
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
    const changes: ChangeFile<"major" | "minor" | "patch">[] = [
      new ChangeFile<"major" | "minor" | "patch">({
        kind: "patch",
        slug: "bug-fix",
        summary: "Bug fix",
      }),
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
    const changes: ChangeFile<"major" | "minor" | "patch">[] = [
      new ChangeFile<"major" | "minor" | "patch">({
        kind: "major",
        slug: "breaking-change",
        summary: "Breaking change",
      }),
      new ChangeFile<"major" | "minor" | "patch">({
        kind: "minor",
        slug: "new-feature",
        summary: "New feature",
      }),
    ];
    const result = strategy.bump({
      version: "1.2.3",
      changes,
      date: new Date(),
    });
    expect(result).toBe("2.0.0");
  });

  it("should graduate 0.x to 1.0.0 on a breaking change by default", () => {
    const strategy = semver();
    const changes: ChangeFile<"major" | "minor" | "patch">[] = [
      new ChangeFile<"major" | "minor" | "patch">({
        kind: "major",
        slug: "breaking-change",
        summary: "Breaking change",
      }),
    ];
    const result = strategy.bump({
      version: "0.5.2",
      changes,
      date: new Date(),
    });
    expect(result).toBe("1.0.0");
  });

  it("should throw on invalid semver", () => {
    const strategy = semver();
    expect(() =>
      strategy.bump({
        version: "1.2",
        changes: [
          new ChangeFile<"major" | "minor" | "patch">({
            kind: "patch",
            slug: "bug-fix",
            summary: "Bug fix",
          }),
        ],
        date: new Date(),
      }),
    ).toThrow("Invalid semantic version");
  });
});

describe("semver unstable", () => {
  const make = (kind: "major" | "minor" | "patch", slug: string) =>
    new ChangeFile<"major" | "minor" | "patch">({ kind, slug, summary: kind });

  it("should bump minor instead of major on a breaking change in 0.x", () => {
    const strategy = semver({ unstable: true });
    const result = strategy.bump({
      version: "0.5.2",
      changes: [make("major", "breaking-change")],
      date: new Date(),
    });
    expect(result).toBe("0.6.0");
  });

  it("should still bump minor on a feature in 0.x", () => {
    const strategy = semver({ unstable: true });
    const result = strategy.bump({
      version: "0.5.2",
      changes: [make("minor", "new-feature")],
      date: new Date(),
    });
    expect(result).toBe("0.6.0");
  });

  it("should still bump patch on a fix in 0.x", () => {
    const strategy = semver({ unstable: true });
    const result = strategy.bump({
      version: "0.5.2",
      changes: [make("patch", "bug-fix")],
      date: new Date(),
    });
    expect(result).toBe("0.5.3");
  });

  it("should bump minor from 0.0.0 on a breaking change", () => {
    const strategy = semver({ unstable: true });
    const result = strategy.bump({
      version: "0.0.0",
      changes: [make("major", "breaking-change")],
      date: new Date(),
    });
    expect(result).toBe("0.1.0");
  });

  it("should still respect highest precedence (major + patch -> minor in 0.x)", () => {
    const strategy = semver({ unstable: true });
    const result = strategy.bump({
      version: "0.5.2",
      changes: [make("major", "breaking-change"), make("patch", "bug-fix")],
      date: new Date(),
    });
    expect(result).toBe("0.6.0");
  });

  it("should not affect versions >= 1.0.0 (major still bumps major)", () => {
    const strategy = semver({ unstable: true });
    const result = strategy.bump({
      version: "1.2.3",
      changes: [make("major", "breaking-change")],
      date: new Date(),
    });
    expect(result).toBe("2.0.0");
  });
});

describe("calver", () => {
  it("should return a strategy with correct allowed_changes", () => {
    const strategy = calver();
    expect(strategy.allowed_changes).toEqual(["feature", "fix"]);
  });

  it("should increment minor when same year", () => {
    const strategy = calver();
    const changes: ChangeFile<"feature" | "fix">[] = [
      new ChangeFile<"feature" | "fix">({
        kind: "feature",
        slug: "new-feature",
        summary: "New feature",
      }),
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
    const changes: ChangeFile<"feature" | "fix">[] = [
      new ChangeFile<"feature" | "fix">({
        kind: "feature",
        slug: "new-feature",
        summary: "New feature",
      }),
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
          new ChangeFile<"feature" | "fix">({
            kind: "feature",
            slug: "new-feature",
            summary: "New feature",
          }),
        ],
        date: new Date(),
      }),
    ).toThrow("Invalid calendar version");
  });
});

describe("pre-release suffix tolerance", () => {
  const strategies = {
    semver: { strategy: semver(), base: "1.2.3", other: "1.3.0" },
    calver: { strategy: calver(), base: "2025.1.2", other: "2025.2.0" },
    markver: { strategy: markver(), base: "1.2.3", other: "1.3.0" },
  };

  for (const [name, { strategy, base, other }] of Object.entries(strategies)) {
    describe(name, () => {
      it("validates suffixed versions", () => {
        expect(strategy.validate({ version: base })).toBe(true);
        expect(strategy.validate({ version: `${base}-rc.3` })).toBe(true);
        expect(strategy.validate({ version: `${base}-preview.a1b2c3d` })).toBe(true);
        expect(strategy.validate({ version: `${base}-RC.1` })).toBe(false);
        expect(strategy.validate({ version: `${base}-1` })).toBe(false);
      });

      it("orders a pre-release below its stable base", () => {
        expect(strategy.compare(`${base}-rc.0`, base)).toBe(-1);
        expect(strategy.compare(base, `${base}-rc.0`)).toBe(1);
        expect(strategy.compare(`${base}-alpha.0`, `${base}-beta.0`)).toBe(-1);
        expect(strategy.compare(`${base}-rc.1`, `${base}-rc.2`)).toBe(-1);
        expect(strategy.compare(`${base}-rc.3`, `${base}-rc.3`)).toBe(0);
      });

      it("still orders different bases", () => {
        expect(strategy.compare(base, other)).toBe(-1);
        expect(strategy.compare(`${base}-rc.9`, `${other}-rc.0`)).toBe(-1);
      });
    });
  }
});
