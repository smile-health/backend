// Vitest setup file for warehouse service tests
import { beforeAll, afterAll } from "vitest"

// Global test setup
beforeAll(async () => {
  // Any global setup can go here
  console.log("Setting up warehouse service tests...")
})

// Global test teardown
afterAll(async () => {
  // Any global cleanup can go here
  console.log("Tearing down warehouse service tests...")
})
