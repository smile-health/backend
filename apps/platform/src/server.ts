import "@smile/lib/tracing.ts"
import {
  budgetSourceConsumer,
  entityConsumer,
  mainApp,
  manufactureConsumer,
  userConsumer,
} from "@/wire.js"
import { HTTPError } from "@smile/lib/error.js"
import { httpLogger } from "@smile/lib/logger.js"
import { Hono } from "hono"
import { StatusCode } from "hono/utils/http-status"
import { StatusCodes } from "http-status-codes"
import env from "./config/env.js"

// construct app
const app = new Hono()

app.use(httpLogger)

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.route("/", mainApp)

app.onError((err, c) => {
  if (err instanceof HTTPError) {
    return c.json(
      {
        message: err.message,
        errors: c.get("errors"),
      },
      err.statusCode as StatusCode
    )
  }

  const message = "Internal Server Error"
  if (env.APP_DEBUG) {
    console.error(err)
    return c.json(
      { message, errors: err.stack },
      StatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return c.json({ message }, StatusCodes.INTERNAL_SERVER_ERROR)
})

export default {
  idleTimeout: env.TIMEOUT,
  fetch: app.fetch,
}

// run the worker
export const runWorker = async () => {
  await Promise.all([
    userConsumer.start(),
    entityConsumer.start(),
    budgetSourceConsumer.start(),
    manufactureConsumer.start(),
  ])
}

// TODO: move this implementation to separate threads
// await runWorker()
