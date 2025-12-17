import type { GitProvider, FileChange, PullRequest } from "./types.ts";

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
export function github(options: GitHubOptions): GitProvider {
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
    async get_branch_sha(branch: string): Promise<string> {
      const ref = await api_request(`/git/ref/heads/${branch}`);
      return ref.object.sha;
    },

    async get_file_content(path: string, branch: string): Promise<string | null> {
      try {
        const file = await api_request(`/contents/${path}?ref=${branch}`);
        if (file.type !== "file") {
          return null;
        }
        return Buffer.from(file.content, "base64").toString("utf-8");
      } catch (error: any) {
        if (error.message.includes("404")) {
          return null;
        }
        throw error;
      }
    },

    async create_or_update_branch(
      name: string,
      base_sha: string,
      files: FileChange[],
      message: string,
    ): Promise<string> {
      // Get base tree
      const base_commit = await api_request(`/git/commits/${base_sha}`);
      const base_tree_sha = base_commit.tree.sha;

      // Get all files from base tree (needed for deletions)
      const base_tree = await api_request(`/git/trees/${base_tree_sha}?recursive=1`);

      // Track files to delete
      const files_to_delete = new Set(files.filter((f) => f.content === null).map((f) => f.path));

      // Track files to modify/add
      const files_to_modify = new Map<string, string>();
      for (const file of files) {
        if (file.content !== null) {
          files_to_modify.set(file.path, file.content);
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
          message,
          tree: tree.sha,
          parents: [base_sha],
        }),
      });

      // Create or update branch reference
      try {
        await api_request(`/git/refs/heads/${name}`, {
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
              ref: `refs/heads/${name}`,
              sha: commit.sha,
            }),
          });
        } else {
          throw error;
        }
      }

      return commit.sha;
    },

    async find_pull_request(head_branch: string): Promise<PullRequest | null> {
      const prs = await api_request(`/pulls?head=${owner}:${head_branch}&state=open`);
      if (prs.length === 0) {
        return null;
      }
      const pr = prs[0];
      return {
        number: pr.number,
        url: pr.html_url,
        head_branch: pr.head.ref,
        base_branch: pr.base.ref,
      };
    },

    async create_pull_request(
      head: string,
      base: string,
      title: string,
      body: string,
    ): Promise<PullRequest> {
      const pr = await api_request("/pulls", {
        method: "POST",
        body: JSON.stringify({
          title,
          head,
          base,
          body,
        }),
      });
      return {
        number: pr.number,
        url: pr.html_url,
        head_branch: pr.head.ref,
        base_branch: pr.base.ref,
      };
    },

    async update_pull_request(number: number, title: string, body: string): Promise<void> {
      await api_request(`/pulls/${number}`, {
        method: "PATCH",
        body: JSON.stringify({
          title,
          body,
        }),
      });
    },

    async create_tag(name: string, sha: string, message: string): Promise<void> {
      // Create annotated tag
      const tag = await api_request("/git/tags", {
        method: "POST",
        body: JSON.stringify({
          tag: name,
          message,
          object: sha,
          type: "commit",
        }),
      });

      // Create ref for tag
      await api_request("/git/refs", {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/tags/${name}`,
          sha: tag.sha,
        }),
      });
    },

    async create_release(tag: string, name: string, body: string): Promise<void> {
      await api_request("/releases", {
        method: "POST",
        body: JSON.stringify({
          tag_name: tag,
          name,
          body,
        }),
      });
    },
  };
}
