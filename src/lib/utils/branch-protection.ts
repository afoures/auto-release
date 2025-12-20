import { confirm, isCancel, cancel, log } from "@clack/prompts";
import * as git from "./git.ts";

/**
 * Detect if we're running in a CI environment
 *
 * Checks for common CI environment variables
 */
export function is_ci(): boolean {
  return (
    process.env.CI === "true" ||
    process.env.CONTINUOUS_INTEGRATION === "true" ||
    process.env.BUILD_NUMBER !== undefined ||
    process.env.RUN_ID !== undefined ||
    // GitHub Actions
    process.env.GITHUB_ACTIONS === "true" ||
    // GitLab CI
    process.env.GITLAB_CI === "true" ||
    // Jenkins
    process.env.JENKINS_URL !== undefined ||
    // CircleCI
    process.env.CIRCLECI === "true" ||
    // Travis CI
    process.env.TRAVIS === "true" ||
    // AppVeyor
    process.env.APPVEYOR === "true" ||
    // Azure Pipelines
    process.env.AZURE_HTTP_USER_AGENT !== undefined ||
    // Bitbucket Pipelines
    process.env.BITBUCKET_BUILD_NUMBER !== undefined ||
    // TeamCity
    process.env.TEAMCITY_VERSION !== undefined ||
    // Buildkite
    process.env.BUILDKITE === "true" ||
    // CodeShip
    process.env.CI_NAME !== undefined ||
    // Drone
    process.env.DRONE === "true" ||
    // Semaphore
    process.env.SEMAPHORE === "true" ||
    // Buddy
    process.env.BUDDY === "true" ||
    // Codefresh
    process.env.CF_BUILD_ID !== undefined ||
    // Heroku
    process.env.HEROKU_TEST_RUN_ID !== undefined ||
    // Netlify
    process.env.NETLIFY === "true" ||
    // Vercel
    process.env.VERCEL === "true"
  );
}

/**
 * Check if the current branch matches the target branch
 *
 * If in CI and branches don't match, returns an error.
 * If not in CI and branches don't match, prompts for confirmation.
 *
 * @returns true if execution should continue, false if it should be cancelled
 */
export async function check_branch_protection(
  root: string,
  target_branch: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current_branch = await git.get_current_branch(root);

  if (current_branch === null) {
    return {
      ok: false,
      error: "Could not determine current git branch. Are you in a git repository?",
    };
  }

  if (current_branch === target_branch) {
    return { ok: true };
  }

  const in_ci = is_ci();

  if (in_ci) {
    return {
      ok: false,
      error: `This command can only be run on the '${target_branch}' branch. Current branch: '${current_branch}'`,
    };
  }

  // Not in CI - ask for confirmation
  const should_continue = await confirm({
    message: `You are on branch '${current_branch}', but this command should be run on '${target_branch}'. Continue anyway?`,
    initialValue: false,
  });

  if (isCancel(should_continue)) {
    cancel("Command cancelled");
    return { ok: false, error: "Command cancelled by user" };
  }

  if (!should_continue) {
    log.info(`Command cancelled. Please switch to '${target_branch}' branch to continue.`);
    return { ok: false, error: "Command cancelled by user" };
  }

  return { ok: true };
}
