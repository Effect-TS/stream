/// <reference types="vitest" />
import { effectPlugin } from "@effect/vite-plugin"
import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [
    effectPlugin({
      babel: {
        plugins: [["annotate-pure-calls"]],
        compact: false
      },
      tsconfig: "tsconfig.test.json"
    })
  ],
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
