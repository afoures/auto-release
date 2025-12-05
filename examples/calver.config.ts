import { define_config, default_changelog_formatter } from "../src/index.js";
import { calver } from "../src/calendar-versioning.js";
import { gitlab } from "../src/gitlab-provider.js";
import { node } from "../src/components.js";

/**
 * Example configuration using calver versioning
 */
export default define_config({
  changes_dir: ".changes",
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
  git: {
    provider: gitlab({
      token: process.env.GITLAB_TOKEN!,
      project_id: process.env.GITLAB_PROJECT_ID!,
    }),
  },
});
