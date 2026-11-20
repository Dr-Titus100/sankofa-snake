import { defineConfig, devices } from "@playwright/test";

// The tests play the built game in dist/. Run `npm run build` first.
export default defineConfig({
  testDir: "apps/web/test",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4173" },
  webServer: {
    command: "python3 -m http.server 4173 --directory dist",
    url: "http://localhost:4173/index.html",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
    // WebKit is the engine inside Safari, the closest thing to an iPhone the test runner has.
    { name: "iphone", use: { ...devices["iPhone 13"] } },
  ],
});
