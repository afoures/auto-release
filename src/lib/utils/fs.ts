import { access, mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function read_file(file: string): Promise<string> {
  return readFile(file, "utf-8");
}

export async function write_file(file: string, content: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, content, "utf-8");
}

export async function delete_file(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    throw new Error(`Failed to delete file ${path}`);
  }
}

export async function list_files(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
