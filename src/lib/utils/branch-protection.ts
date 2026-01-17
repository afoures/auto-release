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
