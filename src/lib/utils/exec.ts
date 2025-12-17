import { exec as node_exec } from "node:child_process";
import { promisify } from "node:util";

const exec_promise = promisify(node_exec);

/**
 * Execute a shell command and return stdout/stderr
 */
export async function exec(
  command: string,
  options?: { cwd?: string },
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await exec_promise(command, options);
    return {
      stdout: String(result.stdout),
      stderr: String(result.stderr),
    };
  } catch (error: any) {
    throw new Error(`Command failed: ${command}\n${error.stderr || error.message}`);
  }
}
