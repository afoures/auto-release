import type { ManagedProject } from "../types.ts";

export async function compute_current_version(
  project: ManagedProject,
  { get_file_content }: { get_file_content: (file_path: string) => Promise<string | null> },
): Promise<string | null> {
  const versions = new Set<string>();

  for (const component of project.components) {
    for (const part of component.parts) {
      const file_content = await get_file_content(part.file);
      if (file_content === null) continue;

      const version = part.get_current_version(file_content);
      versions.add(version);
    }
  }

  if (versions.size === 0) {
    return null;
  }

  const sorted_versions = Array.from(versions).sort((a, b) => project.versioning.compare(a, b));
  return sorted_versions.at(-1) ?? null;
}
