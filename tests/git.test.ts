import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import * as git from "../src/lib/utils/git.ts";
import * as fs from "../src/lib/utils/fs.ts";

let dir: string;

function run_git(command: string) {
  execSync(`git -c user.email=test@test -c user.name=test ${command}`, { cwd: dir });
}

function status() {
  return execSync("git status --porcelain", { cwd: dir }).toString().trim();
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "auto-release-git-"));

  await mkdir(join(dir, ".changes"), { recursive: true });
  await writeFile(join(dir, "package.json"), `${JSON.stringify({ version: "1.0.0" })}\n`);
  await writeFile(join(dir, ".changes/patch.1-thing.md"), "a fix");
  await writeFile(join(dir, ".gitignore"), "ignored.txt\n");

  run_git("init -q");
  run_git("add -A");
  run_git("commit -q -m init");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("reset", () => {
  it("restores modified and deleted tracked files", async () => {
    await writeFile(join(dir, "package.json"), `${JSON.stringify({ version: "2.0.0" })}\n`);
    await unlink(join(dir, ".changes/patch.1-thing.md"));

    await git.reset(dir);

    expect(status()).toBe("");
    expect(await fs.read_file(join(dir, "package.json"))).toContain("1.0.0");
    expect(await fs.read_file(join(dir, ".changes/patch.1-thing.md"))).toBe("a fix");
  });

  it("removes untracked files created since HEAD", async () => {
    await writeFile(join(dir, "CHANGELOG.md"), "# Changelog\n");
    await mkdir(join(dir, "packages/app"), { recursive: true });
    await writeFile(join(dir, "packages/app/CHANGELOG.md"), "# Changelog\n");

    await git.reset(dir);

    expect(await fs.exists(join(dir, "CHANGELOG.md"))).toBe(false);
    expect(await fs.exists(join(dir, "packages"))).toBe(false);
    expect(status()).toBe("");
  });

  it("removes staged additions", async () => {
    await writeFile(join(dir, "CHANGELOG.md"), "# Changelog\n");
    run_git("add CHANGELOG.md");

    await git.reset(dir);

    expect(await fs.exists(join(dir, "CHANGELOG.md"))).toBe(false);
    expect(status()).toBe("");
  });

  it("keeps ignored files", async () => {
    await writeFile(join(dir, "ignored.txt"), "build output\n");

    await git.reset(dir);

    expect(await fs.read_file(join(dir, "ignored.txt"))).toBe("build output\n");
  });
});
