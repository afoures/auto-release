import { access, readdir, readFile } from "node:fs/promises";

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

export async function list_files(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}
