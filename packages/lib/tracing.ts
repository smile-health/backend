/*instrumentation.ts*/
import * as opentelemetry from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter as OTLPTraceGrpcExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPTraceExporter as OTLPTraceHttpExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter as OTLPMetricGrpcExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import { OTLPMetricExporter as OTLPMetricHttpExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import {
  trace,
  SpanStatusCode,
  Span,
  Context as OtelContext,
} from "@opentelemetry/api";
import { Context, Next } from "hono";
import { randomUUID } from "crypto";

const otlpEnabled = process.env.OTLP_ENABLED !== "false"; // Default to enabled unless explicitly disabled
const otlpEndpoint = process.env.OTLP_ENDPOINT || "http://localhost:4318";
const useGrpc = process.env.OTLP_PROTOCOL === "grpc";

// Service identification
const serviceName =
  process.env.APP_NAME || process.env.SERVICE_NAME || "smile5";
const serviceVersion = process.env.APP_VERSION || "1.0";
const serviceEnvironment = process.env.NODE_ENV || "development";
const serviceInstance =
  process.env.HOSTNAME || process.env.POD_NAME || "unknown";

// Use HTTP/protobuf exporters by default, or gRPC if specified
const TraceExporter = useGrpc ? OTLPTraceGrpcExporter : OTLPTraceHttpExporter;
const MetricExporter = useGrpc
  ? OTLPMetricGrpcExporter
  : OTLPMetricHttpExporter;

// Only initialize OpenTelemetry SDK if tracing is enabled
if (otlpEnabled) {
  const sdk = new opentelemetry.NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      "service.environment": serviceEnvironment,
      "service.instance.id": serviceInstance,
      "service.namespace": "smile-platform",
    }),
    traceExporter: new (TraceExporter as any)({
      url: `${otlpEndpoint}/v1/traces`,
      headers: {},
    }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new (MetricExporter as any)({
        url: `${otlpEndpoint}/v1/metrics`,
        headers: {},
      }),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-http": {
          enabled: false, // Disable to avoid conflicts with custom middleware tracing
        },
      }),
    ],
  });
  sdk.start();
  console.log(`OpenTelemetry tracing enabled - endpoint: ${otlpEndpoint}`);
} else {
  console.log("OpenTelemetry tracing disabled via OTLP_ENABLED=false");
}

// Custom HTTP Request Tracer
export class HTTPRequestTracer {
  private readonly tracer = trace.getTracer("http-request-tracer");

  public traceRequest = () => {
    return async (c: Context, next: Next) => {
      // If tracing is disabled, just pass through without creating spans
      if (!otlpEnabled) {
        const requestId = randomUUID();
        const startTime = Date.now();
        c.set("request_start_time", startTime);
        c.set("request_id", requestId);
        c.set("middleware_timings", []);

        await next();

        const duration = Date.now() - startTime;
        console.log(
          `[${requestId}] ${c.req.method} ${c.req.path} - ${c.res.status} (${duration}ms) [tracing disabled]`,
        );
        return;
      }

      const requestId = randomUUID();
      const startTime = Date.now();

      return this.tracer.startActiveSpan(
        `HTTP ${c.req.method} ${c.req.path}`,
        {
          attributes: {
            "http.method": c.req.method,
            "http.url": c.req.url,
            "http.route": c.req.path,
            "http.user_agent": c.req.header("user-agent") || "",
            "request.id": requestId,
            "request.start_time": startTime,
            "service.name": serviceName,
            "service.environment": serviceEnvironment,
            "service.instance.id": serviceInstance,
            "service.namespace": "smile-platform",
            "span.kind": "server",
          },
        },
        async (span: Span) => {
          try {
            // Store request start time for middleware tracking
            c.set("request_start_time", startTime);
            c.set("request_id", requestId);
            c.set("middleware_timings", []);

            await next();

            const endTime = Date.now();
            const duration = endTime - startTime;
            const middlewareTimings = c.get("middleware_timings") || [];

            span.setAttributes({
              "http.status_code": c.res.status,
              "http.response_size": c.res.headers.get("content-length") || 0,
              "request.duration_ms": duration,
              "request.end_time": endTime,
              "middleware.count": middlewareTimings.length,
              "middleware.total_time_ms": middlewareTimings.reduce(
                (sum: number, timing: any) => sum + timing.duration,
                0,
              ),
            });

            // Add middleware timing details as events
            middlewareTimings.forEach((timing: any, index: number) => {
              span.addEvent(`middleware.${timing.name}`, {
                "middleware.order": index + 1,
                "middleware.duration_ms": timing.duration,
                "middleware.start_offset_ms": timing.startOffset,
              });
            });

            span.setStatus({
              code:
                c.res.status >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
            });

            console.log(
              `[${requestId}] ${c.req.method} ${c.req.path} - ${c.res.status} (${duration}ms)`,
            );
          } catch (error: any) {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            throw error;
          } finally {
            span.end();
          }
        },
      );
    };
  };
}

// Enhanced Middleware Tracer
export class MiddlewareTracer {
  private readonly tracer = trace.getTracer("middleware-tracer");

  public traceMiddleware = (middlewareName: string) => {
    return async (c: Context, next: Next) => {
      // If tracing is disabled, just pass through without creating spans
      if (!otlpEnabled) {
        const requestStartTime = c.get("request_start_time") || Date.now();
        const middlewareStartTime = Date.now();

        await next();

        const duration = Date.now() - middlewareStartTime;
        console.log(
          `[${c.get("request_id")}] Middleware ${middlewareName}: ${duration}ms [tracing disabled]`,
        );
        return;
      }

      const requestStartTime = c.get("request_start_time") || Date.now();
      const middlewareStartTime = Date.now();
      const startOffset = middlewareStartTime - requestStartTime;

      return this.tracer.startActiveSpan(
        `middleware.${middlewareName}`,
        {
          attributes: {
            "middleware.name": middlewareName,
            "middleware.start_offset_ms": startOffset,
            "http.method": c.req.method,
            "http.route": c.req.path,
            "request.id": c.get("request_id") || "unknown",
            "service.name": serviceName,
            "service.environment": serviceEnvironment,
            "service.instance.id": serviceInstance,
            "service.namespace": "smile-platform",
          },
        },
        async (span: Span) => {
          try {
            await next();

            const middlewareEndTime = Date.now();
            const duration = middlewareEndTime - middlewareStartTime;

            span.setAttributes({
              "middleware.duration_ms": duration,
              "middleware.end_time": middlewareEndTime,
              "http.status_code": c.res.status,
            });

            // Store timing information for the main request span
            const middlewareTimings = c.get("middleware_timings") || [];
            middlewareTimings.push({
              name: middlewareName,
              duration,
              startOffset,
              startTime: middlewareStartTime,
              endTime: middlewareEndTime,
            });
            c.set("middleware_timings", middlewareTimings);

            span.setStatus({
              code:
                c.res.status >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
            });

            console.log(
              `[${c.get("request_id")}] Middleware ${middlewareName}: ${duration}ms`,
            );
          } catch (error: any) {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            throw error;
          } finally {
            span.end();
          }
        },
      );
    };
  };
}

// Route Performance Tracer
export class RouteTracer {
  private readonly tracer = trace.getTracer("route-tracer");

  public traceRoute = (routeName: string) => {
    return async (c: Context, next: Next) => {
      // If tracing is disabled, just pass through without creating spans
      if (!otlpEnabled) {
        const startTime = Date.now();

        await next();

        const duration = Date.now() - startTime;
        console.log(
          `[${c.get("request_id")}] Route ${routeName}: ${duration}ms [tracing disabled]`,
        );
        return;
      }

      return this.tracer.startActiveSpan(
        `route.${routeName}`,
        {
          attributes: {
            "route.name": routeName,
            "http.method": c.req.method,
            "http.route": c.req.path,
            "request.id": c.get("request_id") || "unknown",
            "service.name": serviceName,
            "service.environment": serviceEnvironment,
            "service.instance.id": serviceInstance,
            "service.namespace": "smile-platform",
          },
        },
        async (span: Span) => {
          const startTime = Date.now();

          try {
            await next();

            const duration = Date.now() - startTime;

            span.setAttributes({
              "route.duration_ms": duration,
              "http.status_code": c.res.status,
            });

            span.setStatus({
              code:
                c.res.status >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
            });
          } catch (error: any) {
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            throw error;
          } finally {
            span.end();
          }
        },
      );
    };
  };
}

// Export tracer instances
export const httpRequestTracer = new HTTPRequestTracer();
export const middlewareTracer = new MiddlewareTracer();
export const routeTracer = new RouteTracer();

// Utility function to get current trace context
export const getCurrentTraceContext = () => {
  if (!otlpEnabled) {
    return null;
  }

  const span = trace.getActiveSpan();
  if (span) {
    const spanContext = span.spanContext();
    return {
      traceId: spanContext.traceId,
      spanId: spanContext.spanId,
      traceFlags: spanContext.traceFlags,
    };
  }
  return null;
};

// Performance metrics helper
export const recordPerformanceMetric = (
  metricName: string,
  value: number,
  attributes?: Record<string, any>,
) => {
  if (!otlpEnabled) {
    return; // Skip recording metrics when tracing is disabled
  }

  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(metricName, {
      value,
      timestamp: Date.now(),
      ...attributes,
    });
  }
};

// Database and Redis Tracing Classes
export class DatabaseTracer {
  private readonly tracer = trace.getTracer("database-tracer");

  public traceQuery = <T>(operation: string, query: string, params?: any[]) => {
    return async (executor: () => Promise<T>): Promise<T> => {
      // Log the query for development visibility
      const queryPreview =
        typeof query === "string"
          ? query.substring(0, 200) + (query.length > 200 ? "..." : "")
          : query;
      console.log(`🔍 [DB ${operation}]: ${queryPreview}`);
      if (params && params.length > 0) {
        console.log(
          `📋 [DB Params] (${params.length}):`,
          params.slice(0, 5),
          params.length > 5 ? "..." : "",
        );
      }

      return this.tracer.startActiveSpan(
        `DB ${operation}`,
        {
          attributes: {
            "db.system": "mysql",
            "db.operation": operation,
            "db.statement": query,
            "db.parameters_count": params?.length || 0,
            "service.name": serviceName,
            "service.environment": serviceEnvironment,
            "service.instance.id": serviceInstance,
            "service.namespace": "smile-platform",
          },
        },
        async (span: Span) => {
          const startTime = Date.now();
          try {
            const result = await executor();
            const duration = Date.now() - startTime;

            span.setAttributes({
              "db.duration_ms": duration,
              "db.success": true,
            });

            // Record rows affected if result has length property
            if (result && typeof result === "object" && "length" in result) {
              span.setAttribute("db.rows_affected", (result as any).length);
            }

            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error: any) {
            const duration = Date.now() - startTime;
            span.setAttributes({
              "db.duration_ms": duration,
              "db.success": false,
              "db.error": error.message,
            });
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            throw error;
          }
        },
      );
    };
  };
}

export class RedisTracer {
  private readonly tracer = trace.getTracer("redis-tracer");

  public traceOperation = <T>(operation: string, key?: string, value?: any) => {
    return async (executor: () => Promise<T>): Promise<T> => {
      // Log the Redis operation for development visibility
      console.log(`🔴 [Redis ${operation}]: ${key || "N/A"}`);
      if (value !== undefined && operation.toLowerCase().includes("set")) {
        console.log(
          `📋 [Redis Value]:`,
          typeof value === "string"
            ? value.substring(0, 100) + (value.length > 100 ? "..." : "")
            : value,
        );
      }

      return this.tracer.startActiveSpan(
        `Redis ${operation.toUpperCase()}`,
        {
          attributes: {
            "db.system": "redis",
            "db.operation": operation.toUpperCase(),
            "redis.key": key || "unknown",
            "redis.key_pattern": this.extractKeyPattern(key),
            "service.name": serviceName,
            "service.environment": serviceEnvironment,
            "service.instance.id": serviceInstance,
            "service.namespace": "smile-platform",
          },
        },
        async (span: Span) => {
          const startTime = Date.now();

          // Add operation start event
          span.addEvent("redis.operation.start", {
            "redis.operation": operation,
            "redis.key": key || "unknown",
            "redis.value_provided": value !== undefined,
          });

          try {
            const result = await executor();
            const duration = Date.now() - startTime;

            span.setAttributes({
              "redis.duration_ms": duration,
              "redis.success": true,
            });

            // Add value size for write operations
            if (
              value !== undefined &&
              ["set", "hset", "lpush", "rpush", "sadd"].includes(
                operation.toLowerCase(),
              )
            ) {
              const valueSize =
                typeof value === "string"
                  ? value.length
                  : JSON.stringify(value).length;
              span.setAttribute("redis.value_size_bytes", valueSize);
            }

            // Add result info for read operations
            if (
              result !== undefined &&
              ["get", "hget", "lrange", "smembers"].includes(
                operation.toLowerCase(),
              )
            ) {
              const resultSize =
                typeof result === "string"
                  ? result.length
                  : JSON.stringify(result).length;
              span.setAttribute("redis.result_size_bytes", resultSize);
            }

            // Add success event with result information
            span.addEvent("redis.operation.success", {
              "redis.duration_ms": duration,
              "redis.result_type": typeof result,
              "redis.has_result": result !== undefined && result !== null,
            });

            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error: any) {
            const duration = Date.now() - startTime;
            span.setAttributes({
              "redis.duration_ms": duration,
              "redis.success": false,
              "redis.error": error.message,
            });

            // Add error event
            span.addEvent("redis.operation.error", {
              "error.message": error.message,
              "error.name": error.name,
              "redis.duration_ms": duration,
            });

            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            throw error;
          }
        },
      );
    };
  };

  private extractKeyPattern(key?: string): string {
    if (!key) return "unknown";

    // Extract patterns like user:123 -> user:*
    return key
      .replace(/:\d+/g, ":*")
      .replace(/:[a-f0-9-]{36}/g, ":*") // UUIDs
      .replace(/:[a-f0-9]{32}/g, ":*"); // MD5 hashes
  }
}

// Enhanced Database Manager with Tracing
export class TracedDatabaseManager<DB> {
  private db: any;
  private tracer: DatabaseTracer;

  constructor(db: any) {
    this.db = db;
    this.tracer = new DatabaseTracer();
  }

  // Wrap common database operations with tracing
  async select(query: string, params?: any[]) {
    return this.tracer.traceQuery(
      "SELECT",
      query,
      params,
    )(() => this.db.selectFrom(query).execute());
  }

  async insert(table: string, data: any) {
    const query = `INSERT INTO ${table}`;
    return this.tracer.traceQuery(
      "INSERT",
      query,
    )(() => this.db.insertInto(table).values(data).execute());
  }

  async update(table: string, data: any, where: any) {
    const query = `UPDATE ${table}`;
    return this.tracer.traceQuery(
      "UPDATE",
      query,
    )(() => this.db.updateTable(table).set(data).where(where).execute());
  }

  async delete(table: string, where: any) {
    const query = `DELETE FROM ${table}`;
    return this.tracer.traceQuery(
      "DELETE",
      query,
    )(() => this.db.deleteFrom(table).where(where).execute());
  }

  getDB() {
    return this.db;
  }
}

// Enhanced Redis Client with Tracing
export class TracedRedisClient {
  private redis: any;
  private tracer: RedisTracer;

  constructor(redis: any) {
    this.redis = redis;
    this.tracer = new RedisTracer();
  }

  async get(key: string) {
    return this.tracer.traceOperation("get", key)(() => this.redis.get(key));
  }

  async set(key: string, value: any, ttl?: number) {
    return this.tracer.traceOperation(
      "set",
      key,
      value,
    )(() => {
      if (ttl) {
        return this.redis.setex(key, ttl, value);
      }
      return this.redis.set(key, value);
    });
  }

  async del(key: string) {
    return this.tracer.traceOperation("del", key)(() => this.redis.del(key));
  }

  async hget(key: string, field: string) {
    return this.tracer.traceOperation(
      "hget",
      key,
    )(() => this.redis.hget(key, field));
  }

  async hset(key: string, field: string, value: any) {
    return this.tracer.traceOperation(
      "hset",
      key,
      value,
    )(() => this.redis.hset(key, field, value));
  }

  async lpush(key: string, ...values: any[]) {
    return this.tracer.traceOperation(
      "lpush",
      key,
      values,
    )(() => this.redis.lpush(key, ...values));
  }

  async rpush(key: string, ...values: any[]) {
    return this.tracer.traceOperation(
      "rpush",
      key,
      values,
    )(() => this.redis.rpush(key, ...values));
  }

  async lrange(key: string, start: number, stop: number) {
    return this.tracer.traceOperation(
      "lrange",
      key,
    )(() => this.redis.lrange(key, start, stop));
  }

  async ping() {
    return this.tracer.traceOperation("ping")(() => this.redis.ping());
  }

  // Expose original redis client for advanced operations
  getClient() {
    return this.redis;
  }
}

export class ClickHouseTracer {
  private readonly tracer = trace.getTracer("clickhouse-tracer");

  public traceQuery = <T>(operation: string, query: string, params?: any[]) => {
    return async (executor: () => Promise<T>): Promise<T> => {
      // Log the query for development visibility
      const queryPreview =
        typeof query === "string"
          ? query.substring(0, 200) + (query.length > 200 ? "..." : "")
          : query;
      console.log(`🟡 [ClickHouse ${operation}]: ${queryPreview}`);
      if (params && params.length > 0) {
        console.log(
          `📋 [ClickHouse Params] (${params.length}):`,
          params.slice(0, 5),
          params.length > 5 ? "..." : "",
        );
      }

      return this.tracer.startActiveSpan(
        `ClickHouse ${operation}`,
        {
          attributes: {
            "db.system": "clickhouse",
            "db.operation": operation,
            "db.statement": query,
            "db.parameters_count": params?.length || 0,
            "service.name": serviceName,
            "service.environment": serviceEnvironment,
            "service.instance.id": serviceInstance,
            "service.namespace": "smile-platform",
          },
        },
        async (span: Span) => {
          const startTime = Date.now();
          try {
            const result = await executor();
            const duration = Date.now() - startTime;

            span.setAttributes({
              "db.duration_ms": duration,
              "db.success": true,
            });

            // Record rows affected if result has length property
            if (result && typeof result === "object" && "length" in result) {
              span.setAttribute("db.rows_affected", (result as any).length);
            }

            // Record result metadata for ClickHouse specific info
            if (result && typeof result === "object" && "meta" in result) {
              const meta = (result as any).meta;
              if (meta && Array.isArray(meta)) {
                span.setAttribute("clickhouse.columns_count", meta.length);
              }
            }

            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error: any) {
            const duration = Date.now() - startTime;
            span.setAttributes({
              "db.duration_ms": duration,
              "db.success": false,
              "db.error": error.message,
            });
            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            throw error;
          }
        },
      );
    };
  };
}

// Enhanced ClickHouse Client with Tracing
export class TracedClickHouseClient {
  private clickhouse: any;
  private tracer: ClickHouseTracer;

  constructor(clickhouse: any) {
    this.clickhouse = clickhouse;
    this.tracer = new ClickHouseTracer();
  }

  async query(query: string, params?: any[]) {
    return this.tracer.traceQuery(
      "QUERY",
      query,
      params,
    )(() => this.clickhouse.query(query, params));
  }

  async select(query: string, params?: any[]) {
    return this.tracer.traceQuery(
      "SELECT",
      query,
      params,
    )(() => this.clickhouse.query(query, params));
  }

  async insert(table: string, data: any[]) {
    const query = `INSERT INTO ${table}`;
    return this.tracer.traceQuery(
      "INSERT",
      query,
    )(() => this.clickhouse.insert(table, data));
  }

  async exec(query: string, params?: any[]) {
    return this.tracer.traceQuery(
      "EXEC",
      query,
      params,
    )(() => this.clickhouse.exec(query, params));
  }

  async ping() {
    return this.tracer.traceQuery(
      "PING",
      "SELECT 1",
    )(() => this.clickhouse.ping());
  }

  // Expose original clickhouse client for advanced operations
  getClient() {
    return this.clickhouse;
  }
}

// Export instances
export const databaseTracer = new DatabaseTracer();
export const redisTracer = new RedisTracer();
export const clickhouseTracer = new ClickHouseTracer();

// Inter-service call tracking
export class InterServiceTracer {
  private readonly tracer = trace.getTracer("inter-service-tracer");

  /**
   * Trace inter-service HTTP calls
   * @param targetService - The target service being called
   * @param operation - The operation being performed
   * @param method - HTTP method
   * @param url - Target URL
   * @param headers - Request headers (for context propagation)
   */
  public traceInterServiceCall = <T>(
    targetService: string,
    operation: string,
    method: string,
    url: string,
    headers?: Record<string, string>,
  ) => {
    return async (executor: () => Promise<T>): Promise<T> => {
      const spanName = `inter-service.${targetService}.${operation}`;

      return this.tracer.startActiveSpan(
        spanName,
        {
          attributes: {
            "inter.service.target": targetService,
            "inter.service.operation": operation,
            "http.method": method,
            "http.url": url,
            "service.name": serviceName,
            "service.target": targetService,
            "service.source": serviceName,
            "span.kind": "client",
          },
        },
        async (span: Span) => {
          const startTime = Date.now();

          try {
            // Add service context to headers for propagation
            const enhancedHeaders = {
              ...headers,
              "X-Service-Source": serviceName,
              "X-Service-Target": targetService,
              "X-Service-Operation": operation,
              "X-Request-ID": headers?.["X-Request-ID"] || randomUUID(),
            };

            const result = await executor();
            const duration = Date.now() - startTime;

            span.setAttributes({
              "http.status_code": 200,
              "inter.service.duration_ms": duration,
              "inter.service.success": true,
            });

            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (error: any) {
            const duration = Date.now() - startTime;

            span.setAttributes({
              "inter.service.duration_ms": duration,
              "inter.service.success": false,
              "inter.service.error": error.message,
              "http.status_code": error.statusCode || error.status || 500,
            });

            span.recordException(error);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: error.message,
            });
            throw error;
          } finally {
            span.end();
          }
        },
      );
    };
  };

  /**
   * Extract service context from incoming request headers
   * @param headers - Incoming request headers
   */
  public extractServiceContext(headers: Record<string, string>) {
    return {
      sourceService: headers["X-Service-Source"],
      targetService: headers["X-Service-Target"],
      operation: headers["X-Service-Operation"],
      requestId: headers["X-Request-ID"],
    };
  }

  /**
   * Create a middleware to trace incoming inter-service calls
   */
  public traceIncomingServiceCall = () => {
    return async (c: Context, next: Next) => {
      const headers = c.req.header();
      const serviceContext = this.extractServiceContext(headers);

      // If this is an inter-service call, create a span for it
      if (serviceContext.sourceService) {
        return this.tracer.startActiveSpan(
          `inter-service.receive.${serviceContext.sourceService}`,
          {
            attributes: {
              "inter.service.source": serviceContext.sourceService,
              "inter.service.target":
                serviceContext.targetService || serviceName,
              "inter.service.operation": serviceContext.operation || "unknown",
              "http.method": c.req.method,
              "http.url": c.req.url,
              "http.route": c.req.path,
              "service.name": serviceName,
              "service.source": serviceContext.sourceService,
              "service.target": serviceContext.targetService || serviceName,
              "span.kind": "server",
              "request.id": serviceContext.requestId,
            },
          },
          async (span: Span) => {
            try {
              // Store service context for use in the request
              c.set("service_context", serviceContext);

              await next();

              span.setAttributes({
                "http.status_code": c.res.status,
                "inter.service.success": c.res.status < 400,
              });

              span.setStatus({
                code:
                  c.res.status >= 400
                    ? SpanStatusCode.ERROR
                    : SpanStatusCode.OK,
              });
            } catch (error: any) {
              span.setAttributes({
                "inter.service.success": false,
                "inter.service.error": error.message,
              });

              span.recordException(error);
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message,
              });
              throw error;
            } finally {
              span.end();
            }
          },
        );
      }

      // Not an inter-service call, continue normally
      await next();
    };
  };
}

// Enhanced HTTP client for inter-service calls
export class TracedHTTPClient {
  private interServiceTracer: InterServiceTracer;

  constructor() {
    this.interServiceTracer = new InterServiceTracer();
  }

  /**
   * Make an inter-service HTTP call with tracing
   */
  async callService<T>(
    targetService: string,
    operation: string,
    method: string,
    url: string,
    options?: {
      headers?: Record<string, string>;
      body?: any;
      timeout?: number;
    },
  ): Promise<T> {
    return this.interServiceTracer.traceInterServiceCall(
      targetService,
      operation,
      method,
      url,
      options?.headers,
    )(async () => {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
        },
        body: options?.body ? JSON.stringify(options?.body) : undefined,
        signal: options?.timeout
          ? AbortSignal.timeout(options.timeout)
          : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json();
    });
  }

  /**
   * GET request to another service
   */
  async get<T>(
    targetService: string,
    operation: string,
    url: string,
    headers?: Record<string, string>,
  ) {
    return this.callService<T>(targetService, operation, "GET", url, {
      headers,
    });
  }

  /**
   * POST request to another service
   */
  async post<T>(
    targetService: string,
    operation: string,
    url: string,
    body?: any,
    headers?: Record<string, string>,
  ) {
    return this.callService<T>(targetService, operation, "POST", url, {
      headers,
      body,
    });
  }

  /**
   * PUT request to another service
   */
  async put<T>(
    targetService: string,
    operation: string,
    url: string,
    body?: any,
    headers?: Record<string, string>,
  ) {
    return this.callService<T>(targetService, operation, "PUT", url, {
      headers,
      body,
    });
  }

  /**
   * DELETE request to another service
   */
  async delete<T>(
    targetService: string,
    operation: string,
    url: string,
    headers?: Record<string, string>,
  ) {
    return this.callService<T>(targetService, operation, "DELETE", url, {
      headers,
    });
  }
}

// Service discovery helper
export class ServiceRegistry {
  private static services: Map<string, string> = new Map();

  /**
   * Register a service endpoint
   */
  static registerService(name: string, endpoint: string) {
    this.services.set(name, endpoint);
  }

  /**
   * Get service endpoint
   */
  static getServiceEndpoint(name: string): string {
    const endpoint = this.services.get(name);
    if (!endpoint) {
      throw new Error(`Service ${name} not registered`);
    }
    return endpoint;
  }

  /**
   * Get all registered services
   */
  static getAllServices(): Record<string, string> {
    return Object.fromEntries(this.services);
  }
}

// Export enhanced tracers
export const interServiceTracer = new InterServiceTracer();
export const tracedHTTPClient = new TracedHTTPClient();
