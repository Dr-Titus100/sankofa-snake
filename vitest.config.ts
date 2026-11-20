import { defineConfig } from "vitest/config";

// Unit tests for the rules, and for the parts of the web game that need no browser.
// The browser tests in apps/web/test run with Playwright instead.
export default defineConfig({
  test: { include: ["packages/*/test/**/*.test.ts", "apps/web/unit/**/*.test.ts"] },
});
