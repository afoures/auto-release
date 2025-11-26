import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { AppConfig } from './types.js'

/**
 * Resolved package information
 */
export interface ResolvedPackage {
  path: string
  package_json: any
  version: string
}

/**
 * Resolve and read package.json files for an app
 */
export async function resolve_packages(
  app: AppConfig,
  cwd: string = process.cwd()
): Promise<ResolvedPackage[]> {
  const packages: ResolvedPackage[] = []

  for (const pkg_path of app.packages) {
    const resolved_path = resolve(cwd, pkg_path)
    const package_json_path = join(resolved_path, 'package.json')

    let package_json: any
    try {
      const content = await readFile(package_json_path, 'utf-8')
      package_json = JSON.parse(content)
    } catch (error: any) {
      throw new Error(
        `Failed to read package.json for app "${app.name}" at ${package_json_path}: ${error.message}`
      )
    }

    if (!package_json.version) {
      throw new Error(
        `package.json for app "${app.name}" at ${package_json_path} has no version field`
      )
    }

    packages.push({
      path: package_json_path,
      package_json,
      version: package_json.version,
    })
  }

  return packages
}

/**
 * Get current version for an app (validates all packages have same version)
 */
export async function get_current_version(
  app: AppConfig,
  cwd: string = process.cwd()
): Promise<string> {
  const packages = await resolve_packages(app, cwd)

  if (packages.length === 0) {
    throw new Error(`App "${app.name}" has no packages`)
  }

  const versions = new Set(packages.map((pkg) => pkg.version))

  if (versions.size > 1) {
    throw new Error(
      `App "${app.name}" has mismatched versions across packages: ${Array.from(
        versions
      ).join(', ')}`
    )
  }

  return packages[0].version
}

/**
 * Write new version to all package.json files for an app
 */
export async function write_version(
  app: AppConfig,
  new_version: string,
  cwd: string = process.cwd()
): Promise<void> {
  const packages = await resolve_packages(app, cwd)

  for (const pkg of packages) {
    const updated_package_json = {
      ...pkg.package_json,
      version: new_version,
    }

    await writeFile(
      pkg.path,
      JSON.stringify(updated_package_json, null, 2) + '\n',
      'utf-8'
    )
  }
}

/**
 * Validate that all packages exist and have matching versions
 */
export async function validate_packages(
  apps: AppConfig[],
  cwd: string = process.cwd()
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  for (const app of apps) {
    try {
      await get_current_version(app, cwd)
    } catch (error: any) {
      errors.push(error.message)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
