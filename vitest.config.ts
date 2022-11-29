/// <reference types="vitest" />
import path from "path"
import { defineConfig } from "vite"
import { tsPlugin } from "./plugins/vitePlugin"

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  plugins: [tsPlugin({})],
  test: {
    include: ["./test/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["./test/utils/**/*.ts", "./test/**/*.init.ts"],
    globals: true
  },
  resolve: {
    alias: {
      "@effect/stream/test": path.resolve(__dirname, "/test"),
      "@effect/stream": path.resolve(__dirname, "/src")
    }
  }
})
