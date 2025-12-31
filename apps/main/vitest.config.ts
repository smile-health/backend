import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-plugin-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    setupFiles: ["./src/tests/utils/vitest-setup.ts"],
    globalSetup: ["./src/tests/utils/global-setup.ts"],
    fileParallelism: false,
    isolate: true,
  },
})
