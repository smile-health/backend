import {
  stockBookConsumer,
  periodicMaterialStockConsumer,
  lplpoConsumer,
  warehouseApp,
  stockOpnameConsumer,
  userActivityConsumer
} from "@/wire.js"
import { SpanStatusCode, trace } from "@opentelemetry/api"
import { errorHandler } from "@smile-health/lib/error.js"
import { httpLogger } from "@smile-health/lib/logger.js"
import "@smile-health/lib/tracing.ts"
import {
  httpRequestTracer,
  middlewareTracer,
  getCurrentTraceContext,
  recordPerformanceMetric,
} from "@smile-health/lib/tracing.js"
import { Hono } from "hono"
import env from "./config/env.js"
import moment from "moment"
import { quickSetupService } from "@smile-health/lib/tracing-config"

// construct app
const app = new Hono()

quickSetupService("warehouse-service", app)
// Add HTTP request tracing as the first middleware
app.use("*", httpRequestTracer.traceRequest())

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

app.use(httpLogger)

// Locale middleware with tracing
app.use("*", middlewareTracer.traceMiddleware("locale"), async (c, next) => {
  const locale = c.req.header("Accept-Language") || "en"
  moment.locale(locale) // sets the global locale for this request

  await next()
})

const tracer = trace.getTracer("warehouse-server")

// Enhanced tracing for warehouseApp routes with performance monitoring
const tracedWarehouseApp = new Hono()
tracedWarehouseApp.use("*", middlewareTracer.traceMiddleware("warehouseApp"))
tracedWarehouseApp.use("*", async (c, next) => {
  return tracer.startActiveSpan("warehouseApp.handler", async (span) => {
    const startTime = Date.now()

    try {
      // Record request details
      span.setAttributes({
        "app.name": "warehouseApp",
        "app.version": "1.0",
        "request.path": c.req.path,
        "request.method": c.req.method,
        "request.query_params": JSON.stringify(c.req.queries()),
      })

      await next()

      const duration = Date.now() - startTime

      // Record performance metrics
      recordPerformanceMetric("warehouseApp.request.duration", duration, {
        path: c.req.path,
        method: c.req.method,
        status: c.res.status,
      })

      span.setAttributes({
        "response.status_code": c.res.status,
        "response.duration_ms": duration,
        "response.content_type": c.res.headers.get("content-type") || "unknown",
      })

      span.setStatus({
        code: c.res.status >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
      })
    } catch (error: any) {
      span.recordException(error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      })
      throw error
    } finally {
      span.end()
    }
  })
})

tracedWarehouseApp.route("/", warehouseApp)
app.route("/", tracedWarehouseApp)

// Enhanced error handler with tracing
app.onError((err, c) => {
  const span = trace.getActiveSpan()
  const traceContext = getCurrentTraceContext()

  if (span) {
    span.recordException(err as Error)
    span.setStatus({ code: SpanStatusCode.ERROR })

    // Add error context attributes
    span.setAttributes({
      "error.type": err.constructor.name,
      "error.message": err.message,
      "error.stack_trace": err.stack || "",
    })
  }

  // Log error with trace context for correlation
  console.error(
    `[${traceContext?.traceId || "no-trace"}] Error in warehouse-service:`,
    {
      error: err.message,
      stack: err.stack,
      path: c.req.path,
      method: c.req.method,
    }
  )

  return errorHandler(err, c)
})

export default {
  idleTimeout: env.TIMEOUT,
  fetch: app.fetch,
}

export const runWorker = async () => {
  await Promise.all([
    stockBookConsumer.start(),
    periodicMaterialStockConsumer.start(),
    stockOpnameConsumer.start(),
    lplpoConsumer.start(),
    userActivityConsumer.start()
  ])
}

await runWorker()
