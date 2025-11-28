import { define_config } from "../src/index.js";
import { calver } from "../src/calendar-versioning.js";
import { gitlab } from "../src/gitlab-provider.js";

/**
 * Example configuration using calver versioning
 */
export default define_config({
  apps: [
    {
      name: "api",
      packages: ["packages/api"],
      versioning: calver(),
      changelog: {
        path: "CHANGELOG.md",
      },
      deploy: {
        command:
          "docker build -t myapi:${version} . && docker push myapi:${version}",
      },
    },
  ],
  changes_dir: ".changes",
  git: gitlab({
    token: process.env.GITLAB_TOKEN!,
    project_id: process.env.GITLAB_PROJECT_ID!,
  }),
});
