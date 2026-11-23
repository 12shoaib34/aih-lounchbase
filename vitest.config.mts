import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["product/tests/**/*.test.ts"], fileParallelism: false },
});
