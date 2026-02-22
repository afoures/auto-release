import { define_config } from "@afoures/auto-release";
import { semver } from "@afoures/auto-release/versioning";
import { github } from "@afoures/auto-release/platforms";
import { node } from "@afoures/auto-release/components";

export default define_config({
  changes_dir: ".changes",
  projects: {
    "auto-release": {
      components: [node(".")],
      changelog: "CHANGELOG.md",
      versioning: semver(),
    },
  },
  git: {
    platform: github({
      owner: "afoures",
      repo: "auto-release",
      token: process.env.GITHUB_API_TOKEN!,
    }),
    target_branch: "main",
    default_release_branch_prefix: "release",
  },
});
