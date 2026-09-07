import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { define_config } from "../src/lib/config.ts";
import { node } from "../src/lib/components/node.ts";
import { semver } from "../src/lib/versioning/semantic.ts";
import { generate_release_pr } from "../src/lib/commands/generate-release-pr.ts";
import * as fs from "../src/lib/utils/fs.ts";

type CapturedBranch = { branch_name: string; files: string[] };

let dir: string;
let original_cwd: string;
let branches: CapturedBranch[];

function create_fake_platform() {
  return {
    async create_or_update_branch(args: any) {
      branches.push({
        branch_name: args.branch_name,
        files: args.file_operations.map((op: any) => `${op.type} ${op.file_path}`).sort(),
      });
    },
    async create_or_update_pull_request() {},
  } as any;
}

function git(command: string) {
  execSync(`git -c user.email=test@test -c user.name=test ${command}`, { cwd: dir });
}

async function run(config: any, options?: { dry_run?: boolean }) {
  await generate_release_pr.run({
    args: { config: undefined, "dry-run": options?.dry_run ?? false } as any,
    positionals: [],
    context: { config, root: dir } as any,
  });
}

beforeEach(async () => {
  branches = [];
  original_cwd = process.cwd();
  dir = await mkdtemp(join(tmpdir(), "auto-release-pr-"));
  process.chdir(dir);

  await mkdir(join(dir, "packages/app"), { recursive: true });
  await mkdir(join(dir, "packages/lib"), { recursive: true });
  await mkdir(join(dir, ".changes/app"), { recursive: true });
  await mkdir(join(dir, ".changes/lib"), { recursive: true });

  await writeFile(
    join(dir, "packages/app/package.json"),
    `${JSON.stringify({ name: "app", version: "1.0.0" }, null, 2)}\n`,
  );
  await writeFile(
    join(dir, "packages/lib/package.json"),
    `${JSON.stringify({ name: "lib", version: "2.0.0" }, null, 2)}\n`,
  );
  await writeFile(join(dir, ".changes/app/patch.1-app-thing.md"), "app fix");
  await writeFile(join(dir, ".changes/lib/patch.1-lib-thing.md"), "lib fix");

  git("init -q");
  git("add -A");
  git("commit -q -m init");
});

afterEach(async () => {
  process.chdir(original_cwd);
  await rm(dir, { recursive: true, force: true });
});

function create_config(overrides?: { release_group?: string }) {
  const config = define_config({
    changes_dir: ".changes",
    projects: {
      app: {
        components: [node("packages/app")],
        changelog: "packages/app/CHANGELOG.md",
        versioning: semver(),
        release_group: overrides?.release_group,
      },
      lib: {
        components: [node("packages/lib")],
        changelog: "packages/lib/CHANGELOG.md",
        versioning: semver(),
        release_group: overrides?.release_group,
      },
    },
    git: {
      platform: create_fake_platform(),
      target_branch: "main",
      default_release_branch_prefix: "release",
    },
  });
  config.path = join(dir, "auto-release.config.ts");
  return config;
}

describe("generate-release-pr", () => {
  it("scopes each release branch to its own project's files", async () => {
    await run(create_config());

    expect(branches.map((branch) => branch.branch_name)).toEqual(["release/app", "release/lib"]);

    expect(branches[0].files).toEqual([
      "create packages/app/CHANGELOG.md",
      "delete .changes/app/patch.1-app-thing.md",
      "update packages/app/package.json",
    ]);
    expect(branches[1].files).toEqual([
      "create packages/lib/CHANGELOG.md",
      "delete .changes/lib/patch.1-lib-thing.md",
      "update packages/lib/package.json",
    ]);
  });

  it("groups every project of a release group into a single branch", async () => {
    await run(create_config({ release_group: "all" }));

    expect(branches).toHaveLength(1);
    expect(branches[0].branch_name).toBe("release/all");
    expect(branches[0].files).toEqual([
      "create packages/app/CHANGELOG.md",
      "create packages/lib/CHANGELOG.md",
      "delete .changes/app/patch.1-app-thing.md",
      "delete .changes/lib/patch.1-lib-thing.md",
      "update packages/app/package.json",
      "update packages/lib/package.json",
    ]);
  });

  it("leaves the working directory clean", async () => {
    await run(create_config());

    const status = execSync("git status --porcelain", { cwd: dir }).toString().trim();
    expect(status).toBe("");
    expect(await fs.exists(join(dir, "packages/app/CHANGELOG.md"))).toBe(false);
  });

  it("does not report groups as skipped on a dry run", async () => {
    const logged: string[] = [];
    const log_spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logged.push(args.join(" "));
    });

    try {
      await run(create_config(), { dry_run: true });
    } finally {
      log_spy.mockRestore();
    }

    expect(branches).toHaveLength(0);
    expect(logged.some((line) => line.includes("Skipping group"))).toBe(false);
    expect(logged.some((line) => line.includes("Release app 1.0.1"))).toBe(true);
    expect(logged.some((line) => line.includes("Release lib 2.0.1"))).toBe(true);

    const status = execSync("git status --porcelain", { cwd: dir }).toString().trim();
    expect(status).toBe("");
  });

  it("ignores unrelated uncommitted changes", async () => {
    await writeFile(join(dir, "README.md"), "unrelated\n");

    await run(create_config());

    for (const branch of branches) {
      expect(branch.files.some((file) => file.includes("README.md"))).toBe(false);
    }
  });
});
