import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/bin.ts",
    "src/versioning.ts",
    "src/git-providers.ts",
    "src/components.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
});
