import { constants } from "node:fs";
import { access, mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function read_file(file: string): Promise<string | null> {
  if (!(await exists(file))) {
    return null;
  }
  try {
    return await readFile(file, "utf-8");
  } catch {
    return null;
  }
}

export async function write_file(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content, "utf-8");
}

export async function delete_file(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    throw new Error(`Failed to delete file ${path}`, { cause: error });
  }
}

export type ListFilesSortOption = "creation" | "name" | "modified";

export async function list_files(
  dir: string,
  options?: { sort?: ListFilesSortOption },
): Promise<string[]> {
  try {
    const files = await readdir(dir);

    if (!options?.sort) {
      return files;
    }

    if (options.sort === "name") {
      return files.sort();
    }

    // For creation and modified sorting, we need to get file stats
    const files_with_stats = await Promise.all(
      files.map(async (filename) => {
        const file_path = join(dir, filename);
        try {
          const stats = await stat(file_path);
          return {
            filename,
            birthtime: stats.birthtime,
            mtime: stats.mtime,
          };
        } catch {
          return {
            filename,
            birthtime: new Date(0),
            mtime: new Date(0),
          };
        }
      }),
    );

    if (options.sort === "creation") {
      files_with_stats.sort((a, b) => a.birthtime.getTime() - b.birthtime.getTime());
    } else if (options.sort === "modified") {
      files_with_stats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
    }

    return files_with_stats.map((f) => f.filename);
  } catch {
    return [];
  }
}
