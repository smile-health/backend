console.log("Packages Loaded Successfully");

// Export tracing utilities
export {
  HTTPRequestTracer,
  MiddlewareTracer,
  RouteTracer,
  httpRequestTracer,
  middlewareTracer,
  routeTracer,
  getCurrentTraceContext,
  recordPerformanceMetric,
  DatabaseTracer,
  RedisTracer,
  TracedDatabaseManager,
  TracedRedisClient,
  databaseTracer,
  redisTracer,
  // Enhanced tracing exports
  InterServiceTracer,
  TracedHTTPClient,
  ServiceRegistry,
  interServiceTracer,
  tracedHTTPClient,
  clickhouseTracer,
  ClickHouseTracer,
  TracedClickHouseClient,
} from "./tracing.js";

// Export legacy tracing middleware for backward compatibility
export { TracingMiddleware } from "./tracing-middleware.js";

// Export database tracing plugin
export { DatabaseTracingPlugin } from "./database-tracing.plugin.js";

// Export tracing configuration helpers
export {
  configureServiceTracing,
  applyTracingMiddleware,
  createTracedRoute,
  ServiceConfigs,
  quickSetupService,
} from "./tracing-config.js";
export type { ServiceConfig } from "./tracing-config.js";

// Export cache utilities
export { TokenCache, createTokenCache } from "./cache.js";
export type { CacheConfig } from "./cache.js";

// Export feature flags utilities
export { featureFlagsMiddleware } from "./feature-flags/index.js";
