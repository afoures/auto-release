import type { GitProvider, FileChange, PullRequest } from "./types.js";

interface GitLabOptions {
  token: string;
  project_id: string;
  host?: string; // Default: gitlab.com
}

/**
 * GitLab provider implementation using REST API
 */
export function gitlab(options: GitLabOptions): GitProvider {
  const { token, project_id, host = "gitlab.com" } = options;
  const api_base = `https://${host}/api/v4/projects/${encodeURIComponent(
    project_id
  )}`;

  async function api_request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${api_base}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "PRIVATE-TOKEN": token,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error_text = await response.text();
      throw new Error(
        `GitLab API error: ${response.status} ${response.statusText}\n${error_text}`
      );
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }

  return {
    async get_branch_sha(branch: string): Promise<string> {
      const ref = await api_request(
        `/repository/branches/${encodeURIComponent(branch)}`
      );
      return ref.commit.id;
    },

    async get_file_content(
      path: string,
      branch: string
    ): Promise<string | null> {
      try {
        const url = `${api_base}/repository/files/${encodeURIComponent(
          path
        )}/raw?ref=${encodeURIComponent(branch)}`;
        const response = await fetch(url, {
          headers: {
            "PRIVATE-TOKEN": token,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          const error_text = await response.text();
          throw new Error(
            `GitLab API error: ${response.status} ${response.statusText}\n${error_text}`
          );
        }

        return await response.text();
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
      message: string
    ): Promise<string> {
      // GitLab uses commits API with actions
      const actions = files.map((file) => {
        if (file.content === null) {
          return {
            action: "delete",
            file_path: file.path,
          };
        }
        return {
          action: "update",
          file_path: file.path,
          content: file.content,
        };
      });

      // Check if branch exists
      let branch_exists = false;
      try {
        await api_request(`/repository/branches/${encodeURIComponent(name)}`);
        branch_exists = true;
      } catch (error: any) {
        if (!error.message.includes("404")) {
          throw error;
        }
      }

      // Create commit
      const commit = await api_request("/repository/commits", {
        method: "POST",
        body: JSON.stringify({
          branch: name,
          commit_message: message,
          actions,
          start_branch: branch_exists ? name : undefined,
          start_sha: branch_exists ? undefined : base_sha,
        }),
      });

      return commit.id;
    },

    async find_pull_request(head_branch: string): Promise<PullRequest | null> {
      // GitLab calls them "merge requests"
      const mrs = await api_request(
        `/merge_requests?state=opened&source_branch=${encodeURIComponent(
          head_branch
        )}`
      );
      if (mrs.length === 0) {
        return null;
      }
      const mr = mrs[0];
      return {
        number: mr.iid,
        url: mr.web_url,
        head_branch: mr.source_branch,
        base_branch: mr.target_branch,
      };
    },

    async create_pull_request(
      head: string,
      base: string,
      title: string,
      body: string
    ): Promise<PullRequest> {
      const mr = await api_request("/merge_requests", {
        method: "POST",
        body: JSON.stringify({
          source_branch: head,
          target_branch: base,
          title,
          description: body,
        }),
      });
      return {
        number: mr.iid,
        url: mr.web_url,
        head_branch: mr.source_branch,
        base_branch: mr.target_branch,
      };
    },

    async update_pull_request(
      number: number,
      title: string,
      body: string
    ): Promise<void> {
      await api_request(`/merge_requests/${number}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          description: body,
        }),
      });
    },

    async create_tag(
      name: string,
      sha: string,
      message: string
    ): Promise<void> {
      await api_request("/repository/tags", {
        method: "POST",
        body: JSON.stringify({
          tag_name: name,
          ref: sha,
          message,
        }),
      });
    },

    async create_release(
      tag: string,
      name: string,
      body: string
    ): Promise<void> {
      await api_request("/releases", {
        method: "POST",
        body: JSON.stringify({
          tag_name: tag,
          name,
          description: body,
        }),
      });
    },
  };
}
