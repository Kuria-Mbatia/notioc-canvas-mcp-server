import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.{test,spec}.{js,ts}"],
    typecheck: {
      tsconfig: "./tsconfig.test.json",
    },
    coverage: {
      reporter: ["text", "text-summary", "json-summary", "json"],
      reportOnFailure: true,
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    target: "es2022",
  },
});
