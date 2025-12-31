/**
 * Service Tracing Configuration Helper
 *
 * This module provides easy configuration for setting up tracing
 * in different services with proper service identification and
 * inter-service call tracking.
 */

import {
  httpRequestTracer,
  middlewareTracer,
  routeTracer,
  interServiceTracer,
  ServiceRegistry,
  databaseTracer,
  redisTracer,
  clickhouseTracer,
} from "./tracing";
import { Hono } from "hono";

export interface ServiceConfig {
  name: string;
  version: string;
  environment: string;
  instance?: string;
  dependencies?: string[];
  serviceEndpoints?: Record<string, string>;
}

/**
 * Configure tracing for a service
 */
export function configureServiceTracing(config: ServiceConfig) {
  // Set environment variables for service identification
  process.env.APP_NAME = config.name;
  process.env.SERVICE_NAME = config.name;
  process.env.APP_VERSION = config.version;
  process.env.NODE_ENV = config.environment;

  if (config.instance) {
    process.env.HOSTNAME = config.instance;
  }

  // Register service endpoints for dependencies
  if (config.serviceEndpoints) {
    Object.entries(config.serviceEndpoints).forEach(([service, endpoint]) => {
      ServiceRegistry.registerService(service, endpoint);
    });
  }

  console.log(
    `✅ Tracing configured for service: ${config.name} (${config.environment})`,
  );

  if (config.dependencies && config.dependencies.length > 0) {
    console.log(
      `📋 Registered dependencies: ${config.dependencies.join(", ")}`,
    );
  }
}

/**
 * Apply standard tracing middleware to an app
 */
export function applyTracingMiddleware(app: Hono) {
  // Order matters: apply from outermost to innermost

  // 1. HTTP request tracing (outermost)
  app.use("*", httpRequestTracer.traceRequest());

  // 2. Inter-service call detection
  app.use("*", interServiceTracer.traceIncomingServiceCall());

  // 3. Global middleware tracing
  app.use("*", middlewareTracer.traceMiddleware("global"));

  // 4. Route-specific tracing will be applied at route level

  console.log("✅ Tracing middleware applied");
}

/**
 * Create a traced route handler
 */
export function createTracedRoute(
  routeName: string,
  handler: (c: any) => Promise<any> | any,
) {
  return routeTracer.traceRoute(routeName)(handler);
}

/**
 * Predefined service configurations for common services
 */
export const ServiceConfigs = {
  "core-service": {
    name: "core-service",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    dependencies: ["auth-service", "warehouse-service", "notification-service"],
    serviceEndpoints: {
      "auth-service":
        process.env.AUTH_SERVICE_URL || "http://auth-service:3000",
      "warehouse-service":
        process.env.WAREHOUSE_SERVICE_URL || "http://warehouse-service:3001",
      "notification-service":
        process.env.NOTIFICATION_SERVICE_URL ||
        "http://notification-service:3002",
    },
  },

  "main-service": {
    name: "main-service",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    dependencies: ["auth-service", "warehouse-service", "notification-service"],
    serviceEndpoints: {
      "auth-service":
        process.env.AUTH_SERVICE_URL || "http://auth-service:3000",
      "warehouse-service":
        process.env.WAREHOUSE_SERVICE_URL || "http://warehouse-service:3001",
      "notification-service":
        process.env.NOTIFICATION_SERVICE_URL ||
        "http://notification-service:3002",
    },
  },

  "auth-service": {
    name: "auth-service",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    dependencies: ["notification-service"],
    serviceEndpoints: {
      "notification-service":
        process.env.NOTIFICATION_SERVICE_URL ||
        "http://notification-service:3002",
    },
  },

  "warehouse-service": {
    name: "warehouse-service",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    dependencies: ["core-service", "notification-service"],
    serviceEndpoints: {
      "core-service":
        process.env.CORE_SERVICE_URL || "http://core-service:3003",
      "notification-service":
        process.env.NOTIFICATION_SERVICE_URL ||
        "http://notification-service:3002",
    },
  },

  "notification-service": {
    name: "notification-service",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    dependencies: [],
    serviceEndpoints: {},
  },

  "sync-service": {
    name: "sync-service",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    dependencies: ["core-service", "warehouse-service"],
    serviceEndpoints: {
      "core-service":
        process.env.CORE_SERVICE_URL || "http://core-service:3003",
      "warehouse-service":
        process.env.WAREHOUSE_SERVICE_URL || "http://warehouse-service:3001",
    },
  },
};

/**
 * Quick setup function for common services
 */
export function quickSetupService(
  serviceName: keyof typeof ServiceConfigs,
  app: Hono,
) {
  const config = ServiceConfigs[serviceName];
  if (!config) {
    throw new Error(`Unknown service: ${serviceName}`);
  }

  configureServiceTracing(config);
  applyTracingMiddleware(app);

  return config;
}

/**
 * Example usage:
 *
 * ```typescript
 * import { Hono } from 'hono';
 * import { quickSetupService, createTracedRoute } from './tracing-config';
 * import { tracedHTTPClient } from './tracing';
 *
 * const app = new Hono();
 *
 * // Quick setup for core service
 * quickSetupService('core-service', app);
 *
 * // Create traced routes
 * app.get('/api/users', createTracedRoute('get-users', async (c) => {
 *   return { users: [] };
 * }));
 *
 * // Route with inter-service calls
 * app.get('/api/user-profile/:id', createTracedRoute('get-user-profile', async (c) => {
 *   const userId = c.req.param('id');
 *
 *   const [user, inventory] = await Promise.all([
 *     tracedHTTPClient.get('auth-service', 'get-user', `http://auth-service:3000/api/users/${userId}`),
 *     tracedHTTPClient.get('warehouse-service', 'get-inventory', `http://warehouse-service:3001/api/inventory/${userId}`)
 *   ]);
 *
 *   return { user, inventory };
 * }));
 *
 * export default app;
 * ```
 */
