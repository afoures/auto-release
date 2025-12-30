import { define_config } from "./dist/index.mjs";
import { markver } from "./dist/versioning.mjs";
import { github } from "./dist/git-platforms.mjs";
import { node } from "./dist/components.mjs";

export default define_config({
  changes_dir: ".changes",
  apps: {
    "auto-release": {
      components: [node(".")],
      changelog: "CHANGELOG.md",
      versioning: markver(),
    },
  },
  git: {
    platform: github({
      token: process.env.GITHUB_TOKEN!,
      owner: "afoures",
      repo: "auto-release",
    }),
    target_branch: "main",
    default_release_branch_prefix: "release",
  },
});
