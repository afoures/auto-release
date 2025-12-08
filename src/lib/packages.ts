import { resolve } from "node:path";
import type { ManagedApplication } from "./types.js";

/**
 * Resolved component part information
 */
export interface ResolvedPackage {
  path: string;
  version: string;
}

/**
 * Resolve and read component files for an app
 */
export async function resolve_packages(
  app: ManagedApplication,
  cwd: string = process.cwd()
): Promise<ResolvedPackage[]> {
  const packages: ResolvedPackage[] = [];

  for (const component of app.components) {
    const component_result = component();
    for (const part of component_result.parts) {
      const resolved_path = resolve(cwd, part.path);
      const version = part.get_current_version();

      packages.push({
        path: resolved_path,
        version,
      });
    }
  }

  return packages;
}

/**
 * Get current version for an app (validates all components have same version)
 */
export async function get_current_version(
  app: ManagedApplication,
  cwd: string = process.cwd()
): Promise<string> {
  const packages = await resolve_packages(app, cwd);

  if (packages.length === 0) {
    throw new Error(`App "${app.name}" has no components`);
  }

  const versions = new Set(packages.map((pkg) => pkg.version));

  if (versions.size > 1) {
    throw new Error(
      `App "${
        app.name
      }" has mismatched versions across components: ${Array.from(versions).join(
        ", "
      )}`
    );
  }

  return packages[0].version;
}

/**
 * Write new version to all component files for an app
 */
export async function write_version(
  app: ManagedApplication,
  new_version: string
): Promise<void> {
  for (const component of app.components) {
    const component_result = component();
    for (const part of component_result.parts) {
      part.update_version(new_version);
    }
  }
}

/**
 * Validate that all packages exist and have matching versions
 */
export async function validate_packages(
  apps: Array<ManagedApplication>,
  cwd: string = process.cwd()
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  for (const app of apps) {
    try {
      await get_current_version(app, cwd);
    } catch (error: any) {
      errors.push(`App "${app.name}": ${error.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
