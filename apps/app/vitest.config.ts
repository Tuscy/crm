import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@stky/db": path.resolve(__dirname, "../../packages/db/src"),
      "@stky/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@stky/crm": path.resolve(__dirname, "../../packages/crm/src"),
    },
  },
});
