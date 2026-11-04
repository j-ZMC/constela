import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The AI evaluation calls the real provider, so it runs on its own with `npm run eval:ai`, never with `npm test`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["evals/**/*.eval.ts"], testTimeout: 60 * 60 * 1000 },
});
