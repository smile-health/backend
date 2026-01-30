import {
  accountConsumer,
  entityConsumer,
  mainApp,
  tolgeeConsumer,
  coldstorageConsumer,
} from "@/wire.js"
import { SpanStatusCode, trace } from "@opentelemetry/api"
import { ExcelError } from "@smile-health/lib/error-excel.js"
import { errorHandler, HTTPError } from "@smile-health/lib/error.js"
import {
  getCurrentTraceContext,
  httpRequestTracer,
  middlewareTracer,
  recordPerformanceMetric,
} from "@smile-health/lib/tracing.js"
import "@smile-health/lib/tracing.ts"
import { Hono } from "hono"
import { StatusCode } from "hono/utils/http-status"
import { StatusCodes } from "http-status-codes"
import env from "./config/env.js"
import { app as openapiApp } from "./openapi.js"
import { quickSetupService } from "@smile-health/lib/tracing-config"

// construct app
const app = new Hono()

quickSetupService("core-service", app)

// Add HTTP request tracing as the first middleware
app.use("*", httpRequestTracer.traceRequest())

// Health check endpoint
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() })
})

const tracer = trace.getTracer("server")

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
      "request.id": c.get("request_id") || "unknown",
    })
  }

  // Log error with trace context for correlation
  console.error(
    `[${c.get("request_id")}] Error in ${c.req.method} ${c.req.path}:`,
    {
      error: err.message,
      stack: err.stack,
      traceId: traceContext?.traceId,
      spanId: traceContext?.spanId,
    }
  )

  if (err instanceof HTTPError) {
    recordPerformanceMetric("error.http", 1, {
      "error.status_code": err.statusCode,
      "error.message": err.message,
    })

    return c.json(
      {
        message: c.var.t(err.message),
        errors: c.get("errors"),
        traceId: traceContext?.traceId, // Include trace ID for debugging
      },
      err.statusCode as StatusCode
    )
  }

  if (err instanceof ExcelError) {
    recordPerformanceMetric("error.excel", 1, {
      "error.status_code": err.statusCode,
      "error.message": err.message,
    })

    return c.json(
      {
        message: c.var.t(err.message),
        errors: c.var.errors,
        traceId: traceContext?.traceId,
      },
      err.statusCode as StatusCode
    )
  }

  recordPerformanceMetric("error.internal", 1, {
    "error.type": err.constructor.name,
    "error.message": err.message,
  })

  const message = "Internal Server Error"
  if (env.APP_DEBUG) {
    console.error(err)
    return c.json(
      {
        message,
        errors: err.stack,
        traceId: traceContext?.traceId,
      },
      StatusCodes.INTERNAL_SERVER_ERROR
    )
  }

  return errorHandler(err, c)
})

// Enhanced tracing for OpenAPI routes with performance monitoring
const tracedOpenapiApp = new Hono()
tracedOpenapiApp.use("*", middlewareTracer.traceMiddleware("openapi"))
tracedOpenapiApp.use("*", async (c, next) => {
  return tracer.startActiveSpan("openapi.handler", async (span) => {
    const startTime = Date.now()

    try {
      // Record request details
      span.setAttributes({
        "app.name": "openapi",
        "app.version": "1.0",
        "request.path": c.req.path,
        "request.method": c.req.method,
        "request.query_params": JSON.stringify(c.req.queries()),
      })

      await next()

      const duration = Date.now() - startTime

      // Record performance metrics
      recordPerformanceMetric("openapi.request.duration", duration, {
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

// Enhanced tracing for mainApp routes with performance monitoring
const tracedMainApp = new Hono()
tracedMainApp.use("*", middlewareTracer.traceMiddleware("mainApp"))
tracedMainApp.use("*", async (c, next) => {
  return tracer.startActiveSpan("mainApp.handler", async (span) => {
    const startTime = Date.now()

    try {
      // Record request details
      span.setAttributes({
        "app.name": "mainApp",
        "app.version": "1.0",
        "request.path": c.req.path,
        "request.method": c.req.method,
        "request.query_params": JSON.stringify(c.req.queries()),
      })

      await next()

      const duration = Date.now() - startTime

      // Record performance metrics
      recordPerformanceMetric("mainApp.request.duration", duration, {
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

tracedOpenapiApp.route("/", openapiApp)
tracedMainApp.route("/", mainApp)

app.route("/api", tracedOpenapiApp)
app.route("/", tracedMainApp)

export default {
  idleTimeout: env.TIMEOUT,
  fetch: app.fetch,
}

// run the worker with enhanced tracing
export const runWorker = async () => {
  return tracer.startActiveSpan("runWorker", async (span) => {
    const startTime = Date.now()

    try {
      span.setAttributes({
        "worker.type": "message_queue_consumers",
        "worker.consumers": ["accountConsumer", "entityConsumer"],
        "worker.start_time": startTime,
      })

      console.log("Starting message queue consumers...")

      await Promise.all([
        tracer.startActiveSpan(
          "accountConsumer.start",
          async (consumerSpan) => {
            try {
              await accountConsumer.start()
              consumerSpan.setStatus({ code: SpanStatusCode.OK })
              console.log("Account consumer started successfully")
            } catch (err) {
              consumerSpan.recordException(err as Error)
              consumerSpan.setStatus({ code: SpanStatusCode.ERROR })
              throw err
            } finally {
              consumerSpan.end()
            }
          }
        ),
        tracer.startActiveSpan("entityConsumer.start", async (consumerSpan) => {
          try {
            await entityConsumer.start()
            consumerSpan.setStatus({ code: SpanStatusCode.OK })
            console.log("Entity consumer started successfully")
          } catch (err) {
            consumerSpan.recordException(err as Error)
            consumerSpan.setStatus({ code: SpanStatusCode.ERROR })
            throw err
          } finally {
            consumerSpan.end()
          }
        }),
        tracer.startActiveSpan("tolgeeConsumer.start", async (consumerSpan) => {
          try {
            await tolgeeConsumer.start()
            consumerSpan.setStatus({ code: SpanStatusCode.OK })
            console.log("Tolgee consumer started successfully")
          } catch (err) {
            consumerSpan.recordException(err as Error)
            consumerSpan.setStatus({ code: SpanStatusCode.ERROR })
            throw err
          } finally {
            consumerSpan.end()
          }
        }),
        tracer.startActiveSpan(
          "coldstorageConsumer.start",
          async (consumerSpan) => {
            try {
              await coldstorageConsumer.start()
              consumerSpan.setStatus({ code: SpanStatusCode.OK })
              console.log("Coldstorage consumer started successfully")
            } catch (err) {
              consumerSpan.recordException(err as Error)
              consumerSpan.setStatus({ code: SpanStatusCode.ERROR })
              throw err
            } finally {
              consumerSpan.end()
            }
          }
        ),
      ])

      const duration = Date.now() - startTime

      span.setAttributes({
        "worker.startup_duration_ms": duration,
        "worker.status": "running",
      })

      recordPerformanceMetric("worker.startup.duration", duration)

      span.setStatus({ code: SpanStatusCode.OK })
      console.log(`Workers started successfully in ${duration}ms`)
    } catch (err) {
      span.recordException(err as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      console.error("Failed to start workers:", err)
      throw err
    } finally {
      span.end()
    }
  })
}

// TODO: move this implementation to separate threads
await runWorker()
