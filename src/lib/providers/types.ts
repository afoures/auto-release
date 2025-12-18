import type { GitFileOperation } from "../utils/git";

/**
 * Git platform client interface for abstracting Git platform operations (GitHub/GitLab/...).
 */
export interface GitPlatformClient {
  create_or_update_branch(args: {
    branch_name: string;
    base_branch_name: string;
    file_operations: GitFileOperation[];
    commit_message: string;
  }): Promise<any>;

  create_or_update_pull_request(args: {
    head_branch_name: string;
    base_branch_name: string;
    title: string;
    body: string;
    draft?: boolean;
  }): Promise<any>;

  create_tag(args: {
    tag: string;
    commit: {
      sha: string;
      message: string;
    };
  }): Promise<any>;

  create_release(args: {
    tag: string;
    release: {
      name: string;
      body: string;
    };
  }): Promise<any>;
}
