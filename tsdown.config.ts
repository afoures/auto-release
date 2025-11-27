import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/cli.ts",
    "src/versioning/semver.ts",
    "src/versioning/calver.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
});
