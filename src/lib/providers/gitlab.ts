import type { GitPlatformClient } from "./types.ts";
import type { GitFileOperation } from "../utils/git.ts";

interface GitLabOptions {
  token: string;
  project_id: string;
  host?: string; // Default: gitlab.com
}

/**
 * GitLab provider implementation using REST API
 */
export function gitlab(options: GitLabOptions): GitPlatformClient {
  const { token, project_id, host = "gitlab.com" } = options;
  const api_base = `https://${host}/api/v4/projects/${encodeURIComponent(project_id)}`;

  async function api_request(endpoint: string, options: RequestInit = {}): Promise<any> {
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
      throw new Error(`GitLab API error: ${response.status} ${response.statusText}\n${error_text}`);
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
      // GitLab uses commits API with actions
      const actions = file_operations.map((op) => {
        if (op.type === "delete") {
          return {
            action: "delete",
            file_path: op.file_path,
          };
        } else if (op.type === "move") {
          // GitLab doesn't have a direct "move" action, so we use delete + create
          return {
            action: "move",
            file_path: op.file_path,
            previous_path: op.previous_path,
            content: op.content || "",
          };
        } else if (op.type === "create") {
          return {
            action: "create",
            file_path: op.file_path,
            content: op.content,
          };
        } else {
          // update
          return {
            action: "update",
            file_path: op.file_path,
            content: op.content,
          };
        }
      });

      // Get base branch SHA
      const base_ref = await api_request(
        `/repository/branches/${encodeURIComponent(base_branch_name)}`,
      );
      const base_sha = base_ref.commit.id;

      // Check if branch exists
      let branch_exists = false;
      try {
        await api_request(`/repository/branches/${encodeURIComponent(branch_name)}`);
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
          branch: branch_name,
          commit_message: commit_message,
          actions,
          start_branch: branch_exists ? branch_name : undefined,
          start_sha: branch_exists ? undefined : base_sha,
        }),
      });

      return commit.id;
    },

    async create_or_update_pull_request(args: {
      head_branch_name: string;
      base_branch_name: string;
      title: string;
      body: string;
      draft?: boolean;
    }): Promise<any> {
      const { head_branch_name, base_branch_name, title, body, draft = false } = args;

      // GitLab calls them "merge requests"
      // Check if MR already exists
      const mrs = await api_request(
        `/merge_requests?state=opened&source_branch=${encodeURIComponent(head_branch_name)}`,
      );

      if (mrs.length > 0) {
        // Update existing MR
        const mr = mrs[0];
        await api_request(`/merge_requests/${mr.iid}`, {
          method: "PUT",
          body: JSON.stringify({
            title,
            description: body,
            work_in_progress: draft,
          }),
        });
        return {
          number: mr.iid,
          url: mr.web_url,
          head_branch: mr.source_branch,
          base_branch: mr.target_branch,
        };
      } else {
        // Create new MR
        const mr = await api_request("/merge_requests", {
          method: "POST",
          body: JSON.stringify({
            source_branch: head_branch_name,
            target_branch: base_branch_name,
            title,
            description: body,
            work_in_progress: draft,
          }),
        });
        return {
          number: mr.iid,
          url: mr.web_url,
          head_branch: mr.source_branch,
          base_branch: mr.target_branch,
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
      return await api_request("/repository/tags", {
        method: "POST",
        body: JSON.stringify({
          tag_name: tag,
          ref: commit.sha,
          message: commit.message,
        }),
      });
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
          description: release.body,
        }),
      });
    },
  };
}
