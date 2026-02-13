import type { ManagedProject } from "../types.ts";

export type ProjectGroup = {
  name: string;
  projects: ManagedProject[];
};

export function group_projects(projects: ManagedProject[]): ProjectGroup[] {
  const groups = new Map<string, ManagedProject[]>();

  for (const project of projects) {
    const existing = groups.get(project.release_group) ?? [];
    existing.push(project);
    groups.set(project.release_group, existing);
  }

  // Sort groups by name, projects within group by name
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, group_projects]: [string, ManagedProject[]]) => ({
      name,
      projects: group_projects.sort((a: ManagedProject, b: ManagedProject) =>
        a.name.localeCompare(b.name),
      ),
    }));
}

// Helper to check if a group has multiple projects
export function is_multi_project_group(group: ProjectGroup): boolean {
  return group.projects.length > 1;
}
