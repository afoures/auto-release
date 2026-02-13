import { describe, it, expect } from "vitest";
import { group_projects, is_multi_project_group } from "../src/lib/utils/group.ts";
import type { ManagedProject } from "../src/lib/types.ts";

function create_mock_project(name: string, release_group: string): ManagedProject {
  return {
    name,
    release_group,
    components: [],
    versioning: {
      allowed_changes: ["feat", "fix"] as const,
      initial_version: "1.0.0",
      compare: () => 0,
      validate: () => true,
      bump: () => "1.0.0",
      formatter: {
        transform_markdown: () => ({ releases: [] }),
        format_changelog: () => "",
        generate_pr_body: () => "",
        generate_release_notes: () => "",
      },
      display_map: {
        feat: { singular: "Feature", plural: "Features" },
        fix: { singular: "Fix", plural: "Fixes" },
      },
    },
    changelog: "CHANGELOG.md",
    options: {
      skip_release_if_no_change_file: false,
    },
  };
}

describe("group_projects", () => {
  it("groups projects by release_group", () => {
    const projects: ManagedProject[] = [
      create_mock_project("web-app", "frontend"),
      create_mock_project("mobile-app", "frontend"),
      create_mock_project("api-service", "backend"),
    ];

    const groups = group_projects(projects);

    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe("backend");
    expect(groups[0].projects).toHaveLength(1);
    expect(groups[0].projects[0].name).toBe("api-service");

    expect(groups[1].name).toBe("frontend");
    expect(groups[1].projects).toHaveLength(2);
    expect(groups[1].projects.map((p) => p.name)).toEqual(["mobile-app", "web-app"]);
  });

  it("treats single-project groups as individual", () => {
    const projects: ManagedProject[] = [
      create_mock_project("web-app", "web-app"),
      create_mock_project("api-service", "api-service"),
    ];

    const groups = group_projects(projects);

    expect(groups).toHaveLength(2);
    expect(groups[0].projects).toHaveLength(1);
    expect(groups[1].projects).toHaveLength(1);
    expect(groups[0].projects[0].name).toBe("api-service");
    expect(groups[1].projects[0].name).toBe("web-app");
  });

  it("sorts groups alphabetically", () => {
    const projects: ManagedProject[] = [
      create_mock_project("zebra", "z-group"),
      create_mock_project("alpha", "a-group"),
      create_mock_project("beta", "b-group"),
    ];

    const groups = group_projects(projects);

    expect(groups.map((g) => g.name)).toEqual(["a-group", "b-group", "z-group"]);
  });

  it("sorts projects within group alphabetically", () => {
    const projects: ManagedProject[] = [
      create_mock_project("zebra-app", "group"),
      create_mock_project("alpha-app", "group"),
      create_mock_project("beta-app", "group"),
    ];

    const groups = group_projects(projects);

    expect(groups).toHaveLength(1);
    expect(groups[0].projects.map((p) => p.name)).toEqual(["alpha-app", "beta-app", "zebra-app"]);
  });

  it("handles all projects in same group", () => {
    const projects: ManagedProject[] = [
      create_mock_project("app-a", "shared"),
      create_mock_project("app-b", "shared"),
      create_mock_project("app-c", "shared"),
    ];

    const groups = group_projects(projects);

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("shared");
    expect(groups[0].projects).toHaveLength(3);
  });

  it("handles each project in own group (default behavior)", () => {
    const projects: ManagedProject[] = [
      create_mock_project("app-a", "app-a"),
      create_mock_project("app-b", "app-b"),
      create_mock_project("app-c", "app-c"),
    ];

    const groups = group_projects(projects);

    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.projects.length === 1)).toBe(true);
  });

  it("returns empty array for empty input", () => {
    const groups = group_projects([]);
    expect(groups).toHaveLength(0);
  });
});

describe("is_multi_project_group", () => {
  it("returns true for groups with multiple projects", () => {
    const group = {
      name: "frontend",
      projects: [
        create_mock_project("web-app", "frontend"),
        create_mock_project("mobile-app", "frontend"),
      ],
    };

    expect(is_multi_project_group(group)).toBe(true);
  });

  it("returns false for groups with single project", () => {
    const group = {
      name: "backend",
      projects: [create_mock_project("api-service", "backend")],
    };

    expect(is_multi_project_group(group)).toBe(false);
  });

  it("returns false for groups with no projects", () => {
    const group = {
      name: "empty",
      projects: [],
    };

    expect(is_multi_project_group(group)).toBe(false);
  });
});
