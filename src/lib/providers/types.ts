/**
 * File change representation for provider commits
 */
export interface FileChange {
  path: string;
  content: string | null; // null = delete file
}

/**
 * Pull request representation
 */
export interface PullRequest {
  number: number;
  url: string;
  head_branch: string;
  base_branch: string;
}

/**
 * Git provider interface for abstracting GitHub/GitLab operations
 */
export interface GitProvider {
  /**
   * Get the SHA of a branch
   */
  get_branch_sha(branch: string): Promise<string>;

  /**
   * Get file content from a branch
   */
  get_file_content(path: string, branch: string): Promise<string | null>;

  /**
   * Create or update a branch with file changes
   * Returns the new commit SHA
   */
  create_or_update_branch(
    name: string,
    base_sha: string,
    files: FileChange[],
    message: string
  ): Promise<string>;

  /**
   * Find an existing pull request by head branch name
   */
  find_pull_request(head_branch: string): Promise<PullRequest | null>;

  /**
   * Create a new pull request
   */
  create_pull_request(
    head: string,
    base: string,
    title: string,
    body: string
  ): Promise<PullRequest>;

  /**
   * Update an existing pull request
   */
  update_pull_request(
    number: number,
    title: string,
    body: string
  ): Promise<void>;

  /**
   * Create a git tag
   */
  create_tag(name: string, sha: string, message: string): Promise<void>;

  /**
   * Create a release (GitHub release or GitLab release)
   */
  create_release(tag: string, name: string, body: string): Promise<void>;
}
