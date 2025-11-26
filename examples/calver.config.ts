import { define_config, calver_strategy } from "../src/index.js";

/**
 * Example configuration using calver versioning
 */
export default define_config({
  apps: [
    {
      name: "api",
      packages: ["packages/api"],
      versioning: {
        strategy: calver_strategy,
        change_types: ["feature", "fix", "none"],
      },
      deploy: {
        command:
          "docker build -t myapi:${version} . && docker push myapi:${version}",
      },
    },
  ],
  changes_dir: ".changes",
  git: {
    tag_template: "api-${version}",
  },
});
