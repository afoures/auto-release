import { define_config } from "./dist/index.mjs";
import { semver } from "./dist/versioning.mjs";
import { github } from "./dist/git-providers.mjs";
import { node } from "./dist/components.mjs";

/**
 * Example configuration for the auto-release package itself
 *
 * To use this as your actual config, rename to auto-release.config.ts
 */
export default define_config({
  changes_dir: ".changes",
  apps: {
    "auto-release": {
      components: [node(".")],
      changelog: "CHANGELOG.md",
      versioning: semver(),
    },
    "another-app": {
      components: [node(".")],
      changelog: "CHANGELOG.md",
      versioning: semver({
        display_map: {
          major: { singular: "Major", plural: "Major" },
          minor: { singular: "Minor", plural: "Minor" },
          patch: { singular: "Patch", plural: "Patch" },
        },
      }),
    },
  },
  git: {
    platform: github({
      token: process.env.GITHUB_TOKEN!,
      owner: process.env.GITHUB_OWNER!,
      repo: process.env.GITHUB_REPO!,
    }),
    default_target_branch: "main",
    default_release_branch_prefix: "release",
  },
});
