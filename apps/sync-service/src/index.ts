/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosRequestHeaders } from "axios"
import { Hono } from "hono"
import {
  activityConsumer,
  budgetSourceConsumer,
  entityConsumer,
  entityCustomerConsumer,
  entityMaterialConsumer,
  manufactureConsumer,
  materialConsumer,
  orderConsumer,
  orderDroppingConsumer,
  sycExampleConsumer,
  trxConsumer,
  userConsumer,
  orderCommentConsumer,
  orderItemConsumer,
  orderStatusConfirmConsumer,
  orderStatusAllocateConsumer,
  orderStatusShippedConsumer,
  orderStatusCancelConsumer,
  orderStatusFulfilledConsumer,
  programConsumer,
} from "./wire.js"

axios.interceptors.request.use((config) => {
  const allowedHeaders = ["authorization", "content-type"]

  if (config.headers) {
    const filteredHeaders: Record<string, any> = {}

    for (const key of Object.keys(config.headers)) {
      if (allowedHeaders.includes(key.toLowerCase())) {
        filteredHeaders[key] = config.headers[key]
      }
    }

    config.headers = filteredHeaders as AxiosRequestHeaders
  }
  return config
})

axios.interceptors.response.use(
  (response) => response, // Pass successful responses
  (error) => {
    if (error.response) {
      console.error(
        `🚨 API Error: ${error.response.status} - ${error.response.data?.message || error.message}`
      )
    } else if (error.request) {
      console.error("🚨 No response from server", error.request)

      // Check for timeout errors in HTTP requests
      if (error.code === "ETIMEDOUT" || error.message.includes("timeout")) {
        console.error(`⏰ HTTP Request TIMEOUT - External API call timed out`)
        console.error(`🔍 Request details:`, {
          url: error.config?.url,
          method: error.config?.method,
          timeout: error.config?.timeout,
        })
      }

      if (error.code === "ECONNREFUSED") {
        console.error(
          `🔒 HTTP Connection refused - External service may be down`
        )
        console.error(`🔍 Target URL:`, error.config?.url)
      }
    } else {
      console.error("🚨 Axios Error:", error.message)

      if (
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("timeout")
      ) {
        console.error(
          `⏰ Axios TIMEOUT error - This could be the source of your ETIMEDOUT error`
        )
      }
    }

    return Promise.reject(error)
  }
)

// Setup HTTP server for health checks
const app = new Hono()

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

export const runWorker = async () => {
  console.log("🚀 Starting sync-service workers...")

  try {
    await Promise.all([
      sycExampleConsumer.start(),
      activityConsumer.start(),
      budgetSourceConsumer.start(),
      manufactureConsumer.start(),
      materialConsumer.start(),
      entityConsumer.start(),
      entityMaterialConsumer.start(),
      entityCustomerConsumer.start(),
      userConsumer.start(),
      orderConsumer.start(),
      orderDroppingConsumer.start(),
      trxConsumer.start(),
      orderCommentConsumer.start(),
      orderItemConsumer.start(),
      orderStatusConfirmConsumer.start(),
      orderStatusAllocateConsumer.start(),
      orderStatusShippedConsumer.start(),
      orderStatusCancelConsumer.start(),
      programConsumer.start(),
      orderStatusFulfilledConsumer.start(),
    ])

    console.log("✅ All sync-service workers started successfully")
  } catch (error) {
    console.error("❌ Failed to start sync-service workers:", error.message)

    if (
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("timeout")
    ) {
      console.error(
        "⏰ WORKER STARTUP TIMEOUT - One of the services (MySQL, RabbitMQ, Redis) is not responding"
      )
      console.error(
        "🔍 Check the connection logs above to identify which service is timing out"
      )
    }

    throw error
  }
}

console.log("🔧 Initializing sync-service application...")
if (process.env.MIGRATION_MODE !== 'true') {
  await runWorker()
}
