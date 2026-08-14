import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { current_version } from "../src/lib/commands/current-version.ts";
import { semver } from "../src/lib/versioning/semantic.ts";
import { node } from "../src/lib/components/node.ts";
import type { ManagedProject } from "../src/lib/types.ts";

let root: string;
let log: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "auto-release-current-version-"));
  log = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  log.mockRestore();
  rmSync(root, { recursive: true, force: true });
});

function make_project(name: string, paths: string[] = ["."]): ManagedProject {
  return {
    name,
    components: paths.map((path) => node(path)(root)),
    versioning: semver(),
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

function write_package(path: string, version: string) {
  const dir = join(root, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "app", version }, null, 2) + "\n",
  );
}

function output(): string[] {
  return log.mock.calls.map((call) => String(call[0]));
}

describe("current-version command", () => {
  it("prints name and version for a single registered project", async () => {
    write_package(".", "1.2.3");
    const result = await current_version.run({
      args: {} as any,
      positionals: [],
      context: make_context([make_project("app")]),
    });
    expect(result).toEqual({ status: "success", silent: true });
    expect(output()).toEqual(["app 1.2.3"]);
  });

  it("prints one line per project, in config order", async () => {
    write_package("packages/a", "1.2.3");
    write_package("packages/b", "0.5.0");
    const result = await current_version.run({
      args: {} as any,
      positionals: [],
      context: make_context([make_project("a", ["packages/a"]), make_project("b", ["packages/b"])]),
    });
    expect(result.status).toBe("success");
    expect(output()).toEqual(["a 1.2.3", "b 0.5.0"]);
  });

  it("prints the bare version when --project selects one project", async () => {
    write_package("packages/a", "1.2.3");
    write_package("packages/b", "0.5.0");
    const result = await current_version.run({
      args: { project: "b" } as any,
      positionals: [],
      context: make_context([make_project("a", ["packages/a"]), make_project("b", ["packages/b"])]),
    });
    expect(result.status).toBe("success");
    expect(output()).toEqual(["0.5.0"]);
  });

  it("prints the bare version with --project in a single-project repo", async () => {
    write_package(".", "1.2.3");
    const result = await current_version.run({
      args: { project: "app" } as any,
      positionals: [],
      context: make_context([make_project("app")]),
    });
    expect(result.status).toBe("success");
    expect(output()).toEqual(["1.2.3"]);
  });

  it("errors when --project does not match a registered project", async () => {
    write_package(".", "1.2.3");
    const result = await current_version.run({
      args: { project: "nope" } as any,
      positionals: [],
      context: make_context([make_project("app")]),
    });
    expect(result.status).toBe("error");
    expect(output()).toEqual([]);
  });

  it("errors when no project is registered", async () => {
    const result = await current_version.run({
      args: {} as any,
      positionals: [],
      context: make_context([]),
    });
    expect(result.status).toBe("error");
  });

  it("outputs a JSON array of every project with --json", async () => {
    write_package("packages/a", "1.2.3");
    write_package("packages/b", "0.5.0");
    const result = await current_version.run({
      args: { json: true } as any,
      positionals: [],
      context: make_context([make_project("a", ["packages/a"]), make_project("b", ["packages/b"])]),
    });
    expect(result.status).toBe("success");
    expect(JSON.parse(output()[0])).toEqual([
      { project: "a", version: "1.2.3" },
      { project: "b", version: "0.5.0" },
    ]);
  });

  it("keeps the JSON output an array when --project narrows it to one", async () => {
    write_package(".", "1.2.3");
    const result = await current_version.run({
      args: { project: "app", json: true } as any,
      positionals: [],
      context: make_context([make_project("app")]),
    });
    expect(result.status).toBe("success");
    expect(JSON.parse(output()[0])).toEqual([{ project: "app", version: "1.2.3" }]);
  });

  it("errors when a project has no readable component file", async () => {
    const result = await current_version.run({
      args: {} as any,
      positionals: [],
      context: make_context([make_project("app")]),
    });
    expect(result.status).toBe("error");
    expect(output()).toEqual([]);
  });

  it("reports the highest version when components disagree", async () => {
    write_package(".", "1.2.3");
    write_package("packages/b", "1.3.0");
    const result = await current_version.run({
      args: {} as any,
      positionals: [],
      context: make_context([make_project("app", [".", "packages/b"])]),
    });
    expect(result.status).toBe("success");
    expect(output()).toEqual(["app 1.3.0"]);
  });
});
