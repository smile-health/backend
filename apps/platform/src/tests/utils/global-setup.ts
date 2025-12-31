import { migrate } from "@/common/infrastructure/database/migrator.js"
import { StartedTestContainer } from "testcontainers"
import { rabbitMQ, mysql } from "@/tests/utils/container.js"
import env from "@/config/env.js"

let containers: StartedTestContainer[] = []

export async function setup() {
  const startTime = performance.now()

  if (env.TEST_CONTAINER) {
    containers = await Promise.all([rabbitMQ(), mysql()])
  }

  await migrate()

  const timeTaken = performance.now() - startTime
  console.info(`setup took ${timeTaken.toFixed(0)} ms.`)
}

export async function teardown() {
  const isCI = false
  if (isCI) {
    for (const item of containers) {
      item.stop()
    }
  }

  process.exit(0)
}
