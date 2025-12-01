import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/bin.ts",
    "src/semantic-versioning.ts",
    "src/calendar-versioning.ts",
    "src/marketing-versioning.ts",
    "src/github-provider.ts",
    "src/gitlab-provider.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
});
