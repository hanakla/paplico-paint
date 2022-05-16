import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
  esbuild: {
    jsx: 'transform',
    jsxInject: "import React from 'react'",
  },
})
