import { describe, it, expect, vi, beforeEach } from "vitest";
import { tag_release } from "../src/lib/commands/tag-release.ts";
import type { GitPlatformClient } from "../src/lib/providers/types.ts";
import type { ManagedApplication } from "../src/lib/types.ts";
import { semver } from "../src/lib/versioning/semantic.ts";

// Mock git utilities
vi.mock("../src/lib/utils/git.ts", () => {
  const mock_git = {
    get_head_and_parent_shas: vi.fn(),
    read_file_at_revision: vi.fn(),
  };
  return { default: mock_git, ...mock_git };
});

// Mock logger
vi.mock("../src/lib/utils/logger.ts", () => ({
  create_logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    note: vi.fn(),
  }),
}));

// Mock config loading
vi.mock("../src/lib/config.ts", () => ({
  find_nearest_config: vi.fn(),
}));

import * as git from "../src/lib/utils/git.ts";
import { find_nearest_config } from "../src/lib/config.ts";

describe("tag-release", () => {
  const mock_platform: GitPlatformClient = {
    create_or_update_branch: vi.fn(),
    create_or_update_pull_request: vi.fn(),
    create_tag: vi.fn(),
    get_tag: vi.fn(),
    create_release: vi.fn(),
  };

  const mock_app: ManagedApplication = {
    name: "test-app",
    components: [
      {
        root: "/tmp/repo",
        parts: [
          {
            file: "/tmp/repo/package.json",
            exists: true,
            get_current_version: (content: string) => {
              const pkg = JSON.parse(content);
              return pkg.version;
            },
            update_version: (content: string, version: string) => {
              const pkg = JSON.parse(content);
              pkg.version = version;
              return JSON.stringify(pkg, null, 2);
            },
          },
        ],
        issues: [],
      },
    ],
    versioning: semver(),
    changelog: "CHANGELOG.md",
  };

  const mock_config = {
    managed_applications: [mock_app],
    git: {
      platform: mock_platform,
      default_target_branch: "main",
      default_release_branch_prefix: "release",
    },
    changes_dir: ".changes",
    folder: "/tmp/repo",
    path: "/tmp/repo/auto-release.config.ts",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(find_nearest_config).mockResolvedValue({
      config: mock_config as any,
      git_root: "/tmp/repo",
    });
  });

  it("should return success when HEAD has no parent", async () => {
    vi.mocked(git.get_head_and_parent_shas).mockResolvedValue({
      head_sha: "abc123",
      parent_sha: null,
    });

    const context = await tag_release.get_context({
      args: { config: undefined, "dry-run": false },
      cwd: "/tmp/repo",
    });

    const result = await tag_release.run({
      args: { config: undefined, "dry-run": false },
      context,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.message).toContain("no parent commit");
    }
    expect(mock_platform.create_tag).not.toHaveBeenCalled();
    expect(mock_platform.create_release).not.toHaveBeenCalled();
  });

  it("should return success when no version changes detected", async () => {
    vi.mocked(git.get_head_and_parent_shas).mockResolvedValue({
      head_sha: "abc123",
      parent_sha: "def456",
    });

    // Same version in HEAD and base
    vi.mocked(git.read_file_at_revision).mockResolvedValue('{"version": "1.0.0"}');

    const context = await tag_release.get_context({
      args: { config: undefined, "dry-run": false },
      cwd: "/tmp/repo",
    });

    const result = await tag_release.run({
      args: { config: undefined, "dry-run": false },
      context,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.message).toContain("No version changes detected");
    }
    expect(mock_platform.create_tag).not.toHaveBeenCalled();
    expect(mock_platform.create_release).not.toHaveBeenCalled();
  });

  it("should create tag and release when version changes detected", async () => {
    vi.mocked(git.get_head_and_parent_shas).mockResolvedValue({
      head_sha: "abc123",
      parent_sha: "def456",
    });
    vi.mocked(mock_platform.get_tag).mockResolvedValue(null);

    // Different versions: base = 1.0.0, head = 1.1.0
    vi.mocked(git.read_file_at_revision).mockImplementation(async (_cwd, revision) => {
      if (revision === "def456") {
        return '{"version": "1.0.0"}';
      }
      if (revision === "abc123") {
        return '{"version": "1.1.0"}';
      }
      return null;
    });

    const context = await tag_release.get_context({
      args: { config: undefined, "dry-run": false },
      cwd: "/tmp/repo",
    });

    const result = await tag_release.run({
      args: { config: undefined, "dry-run": false },
      context,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.message).toContain("Tagged 1 app");
    }
    expect(mock_platform.create_tag).toHaveBeenCalledWith({
      tag: "test-app@1.1.0",
      commit_sha: "abc123",
      message: "release: test-app@1.1.0",
    });
    expect(mock_platform.create_release).toHaveBeenCalledWith({
      tag: "test-app@1.1.0",
      release: {
        name: "test-app@1.1.0",
        body: expect.stringContaining("changelog"),
      },
    });
  });

  it("should skip tag creation if tag already exists on same commit", async () => {
    vi.mocked(git.get_head_and_parent_shas).mockResolvedValue({
      head_sha: "abc123",
      parent_sha: "def456",
    });
    vi.mocked(mock_platform.get_tag).mockResolvedValue({ commit_sha: "abc123" }); // Tag exists on same commit

    vi.mocked(git.read_file_at_revision).mockImplementation(async (_cwd, revision) => {
      if (revision === "def456") {
        return '{"version": "1.0.0"}';
      }
      if (revision === "abc123") {
        return '{"version": "1.1.0"}';
      }
      return null;
    });

    const context = await tag_release.get_context({
      args: { config: undefined, "dry-run": false },
      cwd: "/tmp/repo",
    });

    const result = await tag_release.run({
      args: { config: undefined, "dry-run": false },
      context,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(mock_platform.create_tag).not.toHaveBeenCalled();
      expect(mock_platform.create_release).not.toHaveBeenCalled();
    }
  });

  it("should return error if tag exists on different commit", async () => {
    vi.mocked(git.get_head_and_parent_shas).mockResolvedValue({
      head_sha: "abc123",
      parent_sha: "def456",
    });
    vi.mocked(mock_platform.get_tag).mockResolvedValue({ commit_sha: "xyz789" }); // Tag exists on different commit

    vi.mocked(git.read_file_at_revision).mockImplementation(async (_cwd, revision) => {
      if (revision === "def456") {
        return '{"version": "1.0.0"}';
      }
      if (revision === "abc123") {
        return '{"version": "1.1.0"}';
      }
      return null;
    });

    const context = await tag_release.get_context({
      args: { config: undefined, "dry-run": false },
      cwd: "/tmp/repo",
    });

    const result = await tag_release.run({
      args: { config: undefined, "dry-run": false },
      context,
    });

    expect(result.status).toBe("error");
    if (result.status === "error") {
      expect(result.error).toContain("already exists but points to different commit");
    }
    expect(mock_platform.create_tag).not.toHaveBeenCalled();
    expect(mock_platform.create_release).not.toHaveBeenCalled();
  });

  it("should show dry-run output without creating tags", async () => {
    vi.mocked(git.get_head_and_parent_shas).mockResolvedValue({
      head_sha: "abc123",
      parent_sha: "def456",
    });

    vi.mocked(git.read_file_at_revision).mockImplementation(async (_cwd, revision) => {
      if (revision === "def456") {
        return '{"version": "1.0.0"}';
      }
      if (revision === "abc123") {
        return '{"version": "1.1.0"}';
      }
      return null;
    });

    const context = await tag_release.get_context({
      args: { config: undefined, "dry-run": false },
      cwd: "/tmp/repo",
    });

    const result = await tag_release.run({
      args: { config: undefined, "dry-run": true },
      context,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.message).toContain("Dry run completed");
    }
    expect(mock_platform.create_tag).not.toHaveBeenCalled();
    expect(mock_platform.create_release).not.toHaveBeenCalled();
  });

  it("should use initial version when HEAD version cannot be read", async () => {
    vi.mocked(git.get_head_and_parent_shas).mockResolvedValue({
      head_sha: "abc123",
      parent_sha: "def456",
    });

    vi.mocked(git.read_file_at_revision).mockResolvedValue(null);
    vi.mocked(mock_platform.get_tag).mockResolvedValue(null);

    const context = await tag_release.get_context({
      args: { config: undefined, "dry-run": false },
      cwd: "/tmp/repo",
    });

    const result = await tag_release.run({
      args: { config: undefined, "dry-run": false },
      context,
    });

    // When files can't be read, it uses initial_version (0.0.0)
    // If base also uses 0.0.0, no version change is detected
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.message).toContain("No version changes detected");
    }
  });

  it("should use initial version when base version cannot be read", async () => {
    vi.mocked(git.get_head_and_parent_shas).mockResolvedValue({
      head_sha: "abc123",
      parent_sha: "def456",
    });
    vi.mocked(mock_platform.get_tag).mockResolvedValue(null);

    vi.mocked(git.read_file_at_revision).mockImplementation(async (_cwd, revision) => {
      if (revision === "abc123") {
        return '{"version": "1.1.0"}';
      }
      // Base revision returns null, will use initial_version (0.0.0)
      return null;
    });

    const context = await tag_release.get_context({
      args: { config: undefined, "dry-run": false },
      cwd: "/tmp/repo",
    });

    const result = await tag_release.run({
      args: { config: undefined, "dry-run": false },
      context,
    });

    // HEAD version is 1.1.0, base version falls back to 0.0.0 (initial_version)
    // So version change is detected: 0.0.0 -> 1.1.0
    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.message).toContain("Tagged 1 app");
    }
    expect(mock_platform.create_tag).toHaveBeenCalledWith({
      tag: "test-app@1.1.0",
      commit_sha: "abc123",
      message: "release: test-app@1.1.0",
    });
  });

  it("should handle multiple apps with version changes", async () => {
    const mock_app2: ManagedApplication = {
      name: "test-app-2",
      components: [
        {
          root: "/tmp/repo",
          parts: [
            {
              file: "/tmp/repo/app2/package.json",
              exists: true,
              get_current_version: (content: string) => {
                const pkg = JSON.parse(content);
                return pkg.version;
              },
              update_version: (content: string, version: string) => {
                const pkg = JSON.parse(content);
                pkg.version = version;
                return JSON.stringify(pkg, null, 2);
              },
            },
          ],
          issues: [],
        },
      ],
      versioning: semver(),
      changelog: "CHANGELOG2.md",
    };

    const multi_app_config = {
      ...mock_config,
      managed_applications: [mock_app, mock_app2],
    };

    vi.mocked(find_nearest_config).mockResolvedValue({
      config: multi_app_config as any,
      git_root: "/tmp/repo",
    });

    vi.mocked(git.get_head_and_parent_shas).mockResolvedValue({
      head_sha: "abc123",
      parent_sha: "def456",
    });
    vi.mocked(mock_platform.get_tag).mockResolvedValue(null);

    vi.mocked(git.read_file_at_revision).mockImplementation(async (_cwd, revision, file_path) => {
      if (revision === "def456") {
        if (file_path.includes("app2")) {
          return '{"version": "2.0.0"}';
        }
        return '{"version": "1.0.0"}';
      }
      if (revision === "abc123") {
        if (file_path.includes("app2")) {
          return '{"version": "2.1.0"}';
        }
        return '{"version": "1.1.0"}';
      }
      return null;
    });

    const context = await tag_release.get_context({
      args: { config: undefined, "dry-run": false },
      cwd: "/tmp/repo",
    });

    const result = await tag_release.run({
      args: { config: undefined, "dry-run": false },
      context,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.message).toContain("Tagged 2 apps");
    }
    expect(mock_platform.create_tag).toHaveBeenCalledTimes(2);
    expect(mock_platform.create_release).toHaveBeenCalledTimes(2);
  });
});
