import { exec } from "./exec.ts";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export type GitFileOperation =
  | {
      type: "create";
      file_path: string;
      content: string;
    }
  | {
      type: "delete";
      file_path: string;
    }
  | {
      type: "move";
      file_path: string;
      previous_path: string;
      content?: string;
    }
  | {
      type: "update";
      file_path: string;
      content: string;
    };

/**
 * Get all file changes in the working directory
 *
 * Returns an array of file operations (create, delete, move, update)
 */
export async function diff(cwd?: string): Promise<Array<GitFileOperation>> {
  const options = cwd ? { cwd } : undefined;

  // Get git status in porcelain format
  // Format: XY path (X = index status, Y = working tree status)
  const { stdout: status_output } = await exec("git status --porcelain", options);

  if (!status_output.trim()) {
    return [];
  }

  const operations: Array<GitFileOperation> = [];
  const lines = status_output.trim().split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    // Parse status line: <XY> <path>
    // X can be: ' ' (unchanged), 'M' (modified), 'A' (added), 'D' (deleted), 'R' (renamed), 'C' (copied)
    // Y can be: ' ' (unchanged), 'M' (modified), 'D' (deleted), '?' (untracked)
    const status = line.substring(0, 2);
    const path_part = line.substring(3).trim();

    const x_status = status[0];
    const y_status = status[1];

    // Handle renamed files: format is "R  old_path -> new_path"
    if (x_status === "R" || y_status === "R") {
      const arrow_index = path_part.indexOf(" -> ");
      if (arrow_index !== -1) {
        const previous_path = path_part.substring(0, arrow_index);
        const file_path = path_part.substring(arrow_index + 4);

        try {
          const full_path = cwd ? resolve(cwd, file_path) : file_path;
          const content = await readFile(full_path, "utf-8");
          operations.push({
            type: "move",
            file_path,
            previous_path,
            content,
          });
        } catch {
          // If file can't be read, still record the move without content
          operations.push({
            type: "move",
            file_path,
            previous_path,
          });
        }
      }
      continue;
    }

    // Determine operation type for non-renamed files
    if (y_status === "?") {
      // Untracked file - treat as create
      try {
        const full_path = cwd ? resolve(cwd, path_part) : path_part;
        const content = await readFile(full_path, "utf-8");
        operations.push({
          type: "create",
          file_path: path_part,
          content,
        });
      } catch {
        // Skip files that can't be read
        continue;
      }
    } else if (x_status === "D" || y_status === "D") {
      // Deleted file
      operations.push({
        type: "delete",
        file_path: path_part,
      });
    } else if (x_status === "A" || x_status === "C") {
      // Added or copied file (staged) - treat as create
      try {
        const full_path = cwd ? resolve(cwd, path_part) : path_part;
        const content = await readFile(full_path, "utf-8");
        operations.push({
          type: "create",
          file_path: path_part,
          content,
        });
      } catch {
        // Skip files that can't be read
        continue;
      }
    } else if (x_status === "M" || y_status === "M") {
      // Modified file (staged or unstaged) - treat as update
      try {
        const full_path = cwd ? resolve(cwd, path_part) : path_part;
        const content = await readFile(full_path, "utf-8");
        operations.push({
          type: "update",
          file_path: path_part,
          content,
        });
      } catch {
        // Skip files that can't be read
        continue;
      }
    }
  }

  return operations;
}

/**
 * Reset all changes in the working directory
 *
 * Discards all uncommitted changes
 */
export async function reset(cwd?: string): Promise<void> {
  const options = cwd ? { cwd } : undefined;
  await exec("git reset --hard HEAD", options);
}

/**
 * Get the SHA of the current HEAD commit and its first parent
 *
 * Returns both SHAs in a single call for efficiency
 */
export async function get_head_and_parent_shas(
  cwd?: string,
): Promise<{ head_sha: string; parent_sha: string | null }> {
  const options = cwd ? { cwd } : undefined;
  const head_sha = (await exec("git rev-parse HEAD", options)).stdout.trim();

  let parent_sha: string | null = null;
  try {
    parent_sha = (await exec("git rev-parse HEAD^1", options)).stdout.trim();
  } catch {
    // HEAD has no parent (e.g., initial commit)
    parent_sha = null;
  }

  return { head_sha, parent_sha };
}

/**
 * Read file content at a specific git revision
 *
 * Returns null if the file doesn't exist at that revision
 */
export async function read_file_at_revision(
  cwd: string | undefined,
  revision: string,
  file_path: string,
): Promise<string | null> {
  const options = cwd ? { cwd } : undefined;
  try {
    const { stdout } = await exec(`git show ${revision}:${file_path}`, options);
    return stdout;
  } catch {
    return null;
  }
}

/**
 * Get the current git branch name
 *
 * Returns the branch name or null if not in a git repository or detached HEAD
 */
export async function get_current_branch(cwd?: string): Promise<string | null> {
  const options = cwd ? { cwd } : undefined;
  try {
    // Try to get branch name from symbolic-ref first (works for normal branches)
    try {
      const { stdout } = await exec("git symbolic-ref --short HEAD", options);
      return stdout.trim();
    } catch {
      // If symbolic-ref fails, try to get branch from git branch --show-current
      const { stdout } = await exec("git branch --show-current", options);
      return stdout.trim() ?? null;
    }
  } catch {
    return null;
  }
}
