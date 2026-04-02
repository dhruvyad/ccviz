import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts", "src/server/index.ts"],
  format: "esm",
  outDir: "dist",
  clean: true,
});
