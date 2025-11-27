import { define_config } from "../src/index.js";
import { calver } from "../src/versioning/calver.js";

/**
 * Example configuration using calver versioning
 */
export default define_config({
  apps: [
    {
      name: "api",
      packages: ["packages/api"],
      versioning: calver(),
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
