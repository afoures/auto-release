import { describe, expect, it } from "vitest";
import { generate_config_source, type AppTemplate } from "../src/lib/commands/init.ts";

const base_app: AppTemplate = {
  name: "web-app",
  components: [{ type: "node", path: "apps/web" }],
  changelog_path: "apps/web/CHANGELOG.md",
  versioning: "semver",
};

describe("generate_config_source", () => {
  it("creates a GitHub config with semver strategy", () => {
    const source = generate_config_source({
      apps: [base_app],
      changes_dir: ".changes",
      target_branch: "main",
      default_release_branch_prefix: "release",
      git: {
        platform: "github",
        owner: "acme",
        repo: "web",
        token_env: "GITHUB_TOKEN",
      },
    });

    expect(source).toContain('import { define_config } from "@afoures/auto-release";');
    expect(source).toContain('import { node } from "@afoures/auto-release/components";');
    expect(source).toContain('import { semver } from "@afoures/auto-release/versioning";');
    expect(source).toContain('import { github } from "@afoures/auto-release/platforms";');
    expect(source).toContain('"web-app": {');
    expect(source).toContain('node("apps/web")');
    expect(source).toContain("versioning: semver()");
    expect(source).toContain("github({");
    expect(source).toContain("token: process.env.GITHUB_TOKEN!");
    // Should not contain default values
    expect(source).not.toContain("changes_dir:");
    expect(source).not.toContain("target_branch:");
    expect(source).not.toContain("default_release_branch_prefix:");
  });

  it("creates a GitLab config with calver strategy", () => {
    const apps: AppTemplate[] = [
      {
        ...base_app,
        name: "mobile-app",
        components: [
          { type: "node", path: "apps/mobile" },
          { type: "node", path: "packages/shared" },
        ],
        versioning: "calver",
        changelog_path: "apps/mobile/CHANGELOG.md",
      },
    ];

    const source = generate_config_source({
      apps,
      changes_dir: "changes",
      target_branch: "develop",
      default_release_branch_prefix: "releases",
      git: {
        platform: "gitlab",
        project_id: "acme/mobile",
        host: "gitlab.example.com",
        token_env: "GITLAB_TOKEN",
      },
    });

    expect(source).toContain('import { calver } from "@afoures/auto-release/versioning";');
    expect(source).toContain('import { gitlab } from "@afoures/auto-release/platforms";');
    expect(source).toContain('project_id: "acme/mobile"');
    expect(source).toContain("gitlab({");
    expect(source).toContain('host: "gitlab.example.com"');
    // Should contain non-default values
    expect(source).toContain('changes_dir: "changes"');
    expect(source).toContain('target_branch: "develop"');
    expect(source).toContain('default_release_branch_prefix: "releases"');
    expect(source).toContain('node("apps/mobile")');
    expect(source).toContain('node("packages/shared")');
  });

  it("creates config with markver strategy and multiple component types", () => {
    const apps: AppTemplate[] = [
      {
        name: "full-stack-app",
        components: [
          { type: "node", path: "apps/frontend" },
          { type: "bun", path: "apps/bff" },
          { type: "expo", path: "apps/mobile" },
          { type: "php", path: "apps/backend" },
        ],
        versioning: "markver",
        changelog_path: "CHANGELOG.md",
      },
    ];

    const source = generate_config_source({
      apps,
      changes_dir: ".changes",
      target_branch: "main",
      default_release_branch_prefix: "release",
      git: {
        platform: "github",
        owner: "acme",
        repo: "full-stack",
        token_env: "GITHUB_TOKEN",
      },
    });

    expect(source).toContain('import { bun, expo, node, php } from "@afoures/auto-release/components";');
    expect(source).toContain('import { markver } from "@afoures/auto-release/versioning";');
    expect(source).toContain('node("apps/frontend")');
    expect(source).toContain('bun("apps/bff")');
    expect(source).toContain('expo("apps/mobile")');
    expect(source).toContain('php("apps/backend")');
    expect(source).toContain("versioning: markver()");
  });

  it("generates valid apps record structure", () => {
    const apps: AppTemplate[] = [
      {
        name: "app-one",
        components: [{ type: "node", path: "." }],
        versioning: "semver",
        changelog_path: "CHANGELOG.md",
      },
      {
        name: "app-two",
        components: [{ type: "node", path: "apps/two" }],
        versioning: "calver",
        changelog_path: "apps/two/CHANGELOG.md",
      },
    ];

    const source = generate_config_source({
      apps,
      changes_dir: ".changes",
      target_branch: "main",
      default_release_branch_prefix: "release",
      git: {
        platform: "github",
        owner: "acme",
        repo: "monorepo",
        token_env: "GITHUB_TOKEN",
      },
    });

    expect(source).toContain("apps: {");
    expect(source).toContain('"app-one": {');
    expect(source).toContain('"app-two": {');
    expect(source).not.toContain("apps: [");
  });
});

