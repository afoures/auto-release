import { define_config } from "./dist/index.mjs";
import { semver } from "./dist/semantic-versioning.mjs";
import { github } from "./dist/github-provider.mjs";

/**
 * Example configuration for the auto-release package itself
 *
 * To use this as your actual config, rename to auto-release.config.ts
 */
export default define_config({
  apps: [
    {
      name: "auto-release",
      packages: ["."],
      versioning: semver(),
      changelog: {
        path: "CHANGELOG.md",
      },
      deploy: {
        command: "pnpm publish --access public",
      },
    },
  ],
  changes_dir: ".changes",
  git: {
    provider: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
    tag_template: "v${version}",
  },
});
