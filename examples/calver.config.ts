import { define_config, default_changelog_formatter } from "../src/index.js";
import { calver } from "../src/lib/versioning/calendar.js";
import { gitlab } from "../src/lib/providers/gitlab.js";
import { node } from "../src/lib/components/node.js";

/**
 * Example configuration using calver versioning
 */
export default define_config({
  changes_dir: ".changes",
  git: {
    provider: gitlab({
      token: process.env.GITLAB_TOKEN!,
      project_id: process.env.GITLAB_PROJECT_ID!,
    }),
    default_target_branch: "main",
  },
  apps: {
    api: {
      components: [node("packages/api")],
      changelog: "CHANGELOG.md",
      versioning: calver({
        formatter: default_changelog_formatter({
          kind_map: {
            feature: "Feature",
            fix: "Bug Fix",
          },
        }),
      }),
    },
  },
});
