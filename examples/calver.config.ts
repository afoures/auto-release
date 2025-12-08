import { define_config } from "../src/index.js";
import { calver } from "../src/lib/versioning/calendar.js";
import { gitlab } from "../src/lib/providers/gitlab.js";
import { node } from "../src/lib/components/node.js";

/**
 * Example configuration using calver versioning
 */
export default define_config({
  apps: {
    api: {
      components: [node("packages/api")],
      changelog: "CHANGELOG.md",
      versioning: calver(),
    },
  },
  git: {
    provider: gitlab({
      token: process.env.GITLAB_TOKEN!,
      project_id: process.env.GITLAB_PROJECT_ID!,
    }),
  },
});
