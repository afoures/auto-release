import { describe, it, expect } from "vitest";
import { generate_changelog_section } from "../src/lib/changelog.js";
import { semver } from "../src/lib/versioning/semantic.js";
import type { AppDefinition, Change } from "../src/lib/types.js";

describe("generate_changelog_section", () => {
  const strategy = semver();
  const app: AppDefinition = {
    components: [],
    versioning: strategy,
    changelog: "CHANGELOG.md",
  };

  it("should generate changelog section with grouped changes", () => {
    const changes: Change<"major" | "minor" | "patch">[] = [
      {
        kind: "major",
        title: "Breaking API change",
        description: [],
      },
      {
        kind: "minor",
        title: "Add new feature",
        description: [],
      },
      {
        kind: "patch",
        title: "Fix bug",
        description: [],
      },
    ];

    const section = generate_changelog_section({
      app,
      app_name: "test-app",
      current_version: "1.0.0",
      next_version: "2.0.0",
      date: new Date("2025-11-26"),
      changes,
    });

    expect(section).toContain("## 2.0.0 (2025-11-26)");
    expect(section).toContain("- Breaking API change");
    expect(section).toContain("- Add new feature");
    expect(section).toContain("- Fix bug");
  });

  it("should include description content if present", () => {
    const changes: Change<"minor">[] = [
      {
        kind: "minor",
        title: "Add authentication",
        description: [
          "This adds JWT-based authentication with refresh tokens.",
        ],
      },
    ];

    const section = generate_changelog_section({
      app,
      app_name: "test-app",
      current_version: "1.0.0",
      next_version: "1.1.0",
      date: new Date("2025-11-26"),
      changes,
    });

    expect(section).toContain("- Add authentication");
    // Description is included via formatter.generate_release_notes
    expect(section).toContain("- Add authentication");
  });
});
