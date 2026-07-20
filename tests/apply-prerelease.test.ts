import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply_prerelease } from "../src/lib/commands/apply-prerelease.ts";
import { semver } from "../src/lib/versioning/semantic.ts";
import { calver } from "../src/lib/versioning/calendar.ts";
import { node } from "../src/lib/components/node.ts";
import type { ManagedProject } from "../src/lib/types.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "auto-release-apply-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function make_project(name: string, versioning: ManagedProject["versioning"]): ManagedProject {
  return {
    name,
    components: [node(".")(root)],
    versioning,
    changelog: join(root, "CHANGELOG.md"),
    release_group: name,
    options: { skip_release_if_no_change_file: false },
  };
}

function make_context(projects: ManagedProject[]) {
  return {
    config: { changes_dir: join(root, ".changes"), managed_projects: projects },
    root,
  } as any;
}

function write_package(version: string) {
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "app", version }, null, 2) + "\n",
  );
}

function read_version(): string {
  return JSON.parse(readFileSync(join(root, "package.json"), "utf-8")).version;
}

function write_change(project: string, filename: string, content: string) {
  const dir = join(root, ".changes", project);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
}

describe("apply-prerelease command", () => {
  it("computes the next stable base from change files (feature-branch case)", async () => {
    write_package("1.2.2");
    write_change("app", "patch.1-foo.md", "Fix a bug");
    const result = await apply_prerelease.run({
      args: { channel: "preview", id: "abc1234" } as any,
      positionals: [],
      context: make_context([make_project("app", semver())]),
    });
    expect(result.status).toBe("success");
    expect(read_version()).toBe("1.2.3-preview.abc1234");
    // change files are NOT consumed by apply-prerelease
    expect(existsSync(join(root, ".changes", "app", "patch.1-foo.md"))).toBe(true);
  });

  it("uses the current version as-is when there are no change files (release-branch case)", async () => {
    write_package("1.2.3");
    const result = await apply_prerelease.run({
      args: { channel: "rc", id: "3" } as any,
      positionals: [],
      context: make_context([make_project("app", semver())]),
    });
    expect(result.status).toBe("success");
    expect(read_version()).toBe("1.2.3-rc.3");
  });

  it("works with a non-semver scheme (calver)", async () => {
    write_package("2025.1.2");
    const result = await apply_prerelease.run({
      args: { channel: "rc", id: "3" } as any,
      positionals: [],
      context: make_context([make_project("app", calver())]),
    });
    expect(result.status).toBe("success");
    expect(read_version()).toBe("2025.1.2-rc.3");
  });

  it("errors when --id is missing", async () => {
    write_package("1.2.3");
    const result = await apply_prerelease.run({
      args: { channel: "rc" } as any,
      positionals: [],
      context: make_context([make_project("app", semver())]),
    });
    expect(result.status).toBe("error");
  });

  it("errors when --channel is missing", async () => {
    write_package("1.2.3");
    const result = await apply_prerelease.run({
      args: { id: "3" } as any,
      positionals: [],
      context: make_context([make_project("app", semver())]),
    });
    expect(result.status).toBe("error");
  });

  it("does not write files on --dry-run", async () => {
    write_package("1.2.3");
    const result = await apply_prerelease.run({
      args: { channel: "rc", id: "3", "dry-run": true } as any,
      positionals: [],
      context: make_context([make_project("app", semver())]),
    });
    expect(result.status).toBe("success");
    expect(read_version()).toBe("1.2.3");
  });
});
