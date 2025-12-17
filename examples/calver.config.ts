import { define_config } from "../dist/index.mjs";
import { calver } from "../dist/versioning.mjs";
import { gitlab } from "../dist/git-providers.mjs";
import { node } from "../dist/components.mjs";

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
