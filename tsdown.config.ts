import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/auto-release.ts",
    "src/versioning/semver.ts",
    "src/versioning/calver.ts",
    "src/git/github.ts",
    "src/git/gitlab.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
});
