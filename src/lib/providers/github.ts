import type { GitPlatformClient } from "./types.ts";
import type { GitFileOperation } from "../utils/git.ts";

interface GitHubOptions {
  token: string;
  owner: string;
  repo: string;
}

interface GitHubFile {
  path: string;
  mode: "100644" | "100755" | "040000" | "160000" | "120000";
  type: "blob" | "tree" | "commit";
  sha?: string | null;
  content?: string;
}

/**
 * GitHub provider implementation using REST API
 */
export function github(options: GitHubOptions): GitPlatformClient {
  const { token, owner, repo } = options;
  const api_base = `https://api.github.com/repos/${owner}/${repo}`;

  async function api_request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${api_base}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error_text = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}\n${error_text}`);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }

  return {
    async create_or_update_branch(args: {
      branch_name: string;
      base_branch_name: string;
      file_operations: GitFileOperation[];
      commit_message: string;
    }): Promise<any> {
      const { branch_name, base_branch_name, file_operations, commit_message } = args;
      // Get base branch SHA
      const base_ref = await api_request(`/git/ref/heads/${base_branch_name}`);
      const base_sha = base_ref.object.sha;

      // Get base tree
      const base_commit = await api_request(`/git/commits/${base_sha}`);
      const base_tree_sha = base_commit.tree.sha;

      // Get all files from base tree (needed for deletions)
      const base_tree = await api_request(`/git/trees/${base_tree_sha}?recursive=1`);

      // Track files to delete
      const files_to_delete = new Set(
        file_operations.filter((f) => f.type === "delete").map((f) => f.file_path),
      );

      // Track files to modify/add (including moves)
      const files_to_modify = new Map<string, string>();

      for (const op of file_operations) {
        if (op.type === "create" || op.type === "update") {
          files_to_modify.set(op.file_path, op.content);
        } else if (op.type === "move") {
          files_to_modify.set(op.file_path, op.content || "");
          // Also delete the old path
          files_to_delete.add(op.previous_path);
        }
      }

      // Build tree entries: include all existing files except deleted ones, plus new/modified files
      const tree_entries: GitHubFile[] = [];

      // Include existing files (except deleted ones)
      for (const entry of base_tree.tree || []) {
        if (entry.type === "blob" && !files_to_delete.has(entry.path)) {
          // Only include if not being modified (modified files will be added below)
          if (!files_to_modify.has(entry.path)) {
            tree_entries.push({
              path: entry.path,
              mode: "100644",
              type: "blob",
              sha: entry.sha,
            });
          }
        }
      }

      // Add/modify files
      for (const [path, content] of files_to_modify) {
        // Create blob
        const blob = await api_request("/git/blobs", {
          method: "POST",
          body: JSON.stringify({
            content,
            encoding: "utf-8",
          }),
        });

        tree_entries.push({
          path,
          mode: "100644",
          type: "blob",
          sha: blob.sha,
        });
      }

      // Create tree
      const tree = await api_request("/git/trees", {
        method: "POST",
        body: JSON.stringify({
          base_tree: base_tree_sha,
          tree: tree_entries,
        }),
      });

      // Create commit
      const commit = await api_request("/git/commits", {
        method: "POST",
        body: JSON.stringify({
          message: commit_message,
          tree: tree.sha,
          parents: [base_sha],
        }),
      });

      // Create or update branch reference
      try {
        await api_request(`/git/refs/heads/${branch_name}`, {
          method: "PATCH",
          body: JSON.stringify({
            sha: commit.sha,
            force: false,
          }),
        });
      } catch (error: any) {
        // Branch doesn't exist, create it
        if (error.message.includes("404")) {
          await api_request("/git/refs", {
            method: "POST",
            body: JSON.stringify({
              ref: `refs/heads/${branch_name}`,
              sha: commit.sha,
            }),
          });
        } else {
          throw error;
        }
      }

      return commit.sha;
    },

    async create_or_update_pull_request(args: {
      head_branch_name: string;
      base_branch_name: string;
      title: string;
      body: string;
      draft?: boolean;
    }): Promise<any> {
      const { head_branch_name, base_branch_name, title, body, draft = false } = args;

      // Check if PR already exists
      const prs = await api_request(`/pulls?head=${owner}:${head_branch_name}&state=open`);

      if (prs.length > 0) {
        // Update existing PR
        const pr = prs[0];
        await api_request(`/pulls/${pr.number}`, {
          method: "PATCH",
          body: JSON.stringify({
            title,
            body,
            draft,
          }),
        });
        return {
          number: pr.number,
          url: pr.html_url,
          head_branch: pr.head.ref,
          base_branch: pr.base.ref,
        };
      } else {
        // Create new PR
        const pr = await api_request("/pulls", {
          method: "POST",
          body: JSON.stringify({
            title,
            head: head_branch_name,
            base: base_branch_name,
            body,
            draft,
          }),
        });
        return {
          number: pr.number,
          url: pr.html_url,
          head_branch: pr.head.ref,
          base_branch: pr.base.ref,
        };
      }
    },

    async create_tag(args: {
      tag: string;
      commit: {
        sha: string;
        message: string;
      };
    }): Promise<any> {
      const { tag, commit } = args;
      // Create annotated tag
      const tag_obj = await api_request("/git/tags", {
        method: "POST",
        body: JSON.stringify({
          tag: tag,
          message: commit.message,
          object: commit.sha,
          type: "commit",
        }),
      });

      // Create ref for tag
      await api_request("/git/refs", {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/tags/${tag}`,
          sha: tag_obj.sha,
        }),
      });

      return tag_obj;
    },

    async create_release(args: {
      tag: string;
      release: {
        name: string;
        body: string;
      };
    }): Promise<any> {
      const { tag, release } = args;
      return await api_request("/releases", {
        method: "POST",
        body: JSON.stringify({
          tag_name: tag,
          name: release.name,
          body: release.body,
        }),
      });
    },
  };
}
