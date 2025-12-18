import { describe, expect, it } from "vitest";
import { generate_config_source, type AppTemplate } from "../src/lib/commands/init.ts";

const base_app: AppTemplate = {
  name: "web-app",
  packages: ["apps/web"],
  changelog_path: "apps/web/CHANGELOG.md",
  versioning: "semver",
};

describe("generate_config_source", () => {
  it("creates a GitHub config with semver strategy", () => {
    const source = generate_config_source({
      apps: [base_app],
      changes_dir: ".changes",
      release_branch_prefix: "release",
      git: {
        platform: "github",
        owner: "acme",
        repo: "web",
        token_env: "GITHUB_TOKEN",
      },
    });

    expect(source).toContain('import { semver } from "auto-release/versioning/semver";');
    expect(source).toContain('import { github } from "auto-release/git/github";');
    expect(source).toContain('name: "web-app"');
    expect(source).toContain("github({");
    expect(source).toContain("token: process.env.GITHUB_TOKEN!");
  });

  it("creates a GitLab config with calver strategy", () => {
    const apps: AppTemplate[] = [
      {
        ...base_app,
        name: "mobile-app",
        packages: ["apps/mobile", "packages/shared"],
        versioning: "calver",
        changelog_path: "apps/mobile/CHANGELOG.md",
      },
    ];

    const source = generate_config_source({
      apps,
      changes_dir: "changes",
      release_branch_prefix: "releases",
      git: {
        platform: "gitlab",
        project_id: "acme/mobile",
        host: "gitlab.example.com",
        token_env: "GITLAB_TOKEN",
      },
    });

    expect(source).toContain('import { calver } from "auto-release/versioning/calver";');
    expect(source).toContain('import { gitlab } from "auto-release/git/gitlab";');
    expect(source).toContain('project_id: "acme/mobile"');
    expect(source).toContain("gitlab({");
    expect(source).toContain('host: "gitlab.example.com"');
    expect(source).toContain('changes_dir: "changes"');
    expect(source).toContain('release_branch_prefix: "releases"');
  });
});
