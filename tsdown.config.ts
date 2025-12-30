import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/bin.ts",
    "src/index.ts",
    "src/versioning.ts",
    "src/git-platforms.ts",
    "src/components.ts",
  ],
  format: ["esm"],
  dts: true,
  clean: true,
  minify: false,
  sourcemap: false,
  unbundle: true,
});
