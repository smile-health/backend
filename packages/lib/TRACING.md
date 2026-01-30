# Enhanced OpenTelemetry Tracing System

This document describes the enhanced OpenTelemetry tracing system with service tagging and inter-service call tracking capabilities.

## Features

### 1. Service Tagging/Labeling
Every span now includes comprehensive service identification tags:

- `service.name` - Service name (e.g., "core-service", "auth-service")
- `service.environment` - Environment (e.g., "development", "staging", "production")
- `service.instance.id` - Unique instance identifier (e.g., pod name, hostname)
- `service.namespace` - Service namespace (e.g., "smile-platform")
- `span.kind` - Span type ("server", "client", "internal")

### 2. Inter-Service Call Tracking
Track calls between services with:

- Automatic context propagation via HTTP headers
- Request correlation across services
- Performance metrics for inter-service communication
- Error tracking and failure analysis

### 3. Enhanced Tracers
- **HTTPRequestTracer**: Traces incoming HTTP requests with service tags
- **MiddlewareTracer**: Traces middleware execution with service context
- **RouteTracer**: Traces route handlers with service identification
- **DatabaseTracer**: Traces database queries with service tags
- **RedisTracer**: Traces Redis operations with service context
- **ClickHouseTracer**: Traces ClickHouse queries with service tags
- **InterServiceTracer**: Traces calls between services
- **TracedHTTPClient**: HTTP client with automatic inter-service tracing

## Quick Start

### 1. Basic Service Setup

```typescript
import { Hono } from 'hono';
import { quickSetupService } from '@smile-health/lib/tracing-config';

const app = new Hono();

// Quick setup for your service
quickSetupService('core-service', app);

// Your routes here...
app.get('/api/users', (c) => {
  return c.json({ users: [] });
});
```

### 2. Manual Service Configuration

```typescript
import { configureServiceTracing, applyTracingMiddleware } from '@smile-health/lib/tracing-config';
import { Hono } from 'hono';

const app = new Hono();

// Configure service identification
configureServiceTracing({
  name: 'my-service',
  version: '1.0.0',
  environment: 'production',
  instance: 'pod-123',
  dependencies: ['auth-service', 'warehouse-service'],
  serviceEndpoints: {
    'auth-service': 'http://auth-service:3000',
    'warehouse-service': 'http://warehouse-service:3001'
  }
});

// Apply tracing middleware
applyTracingMiddleware(app);
```

### 3. Making Inter-Service Calls

```typescript
import { tracedHTTPClient } from '@smile-health/lib/tracing';

// Simple GET request to another service
const userData = await tracedHTTPClient.get(
  'auth-service',
  'get-user-details',
  'http://auth-service:3000/api/users/123'
);

// POST request with body
const result = await tracedHTTPClient.post(
  'warehouse-service',
  'create-inventory',
  'http://warehouse-service:3001/api/inventory',
  { item: 'product-123', quantity: 10 }
);
```

### 4. Custom Inter-Service Tracing

```typescript
import { interServiceTracer } from '@smile-health/lib/tracing';

// Manual inter-service call tracing
const result = await interServiceTracer.traceInterServiceCall(
  'target-service',
  'custom-operation',
  'POST',
  'http://target-service:3000/api/custom',
  { 'X-Custom-Header': 'value' }
)(async () => {
  // Your custom HTTP call implementation
  const response = await fetch('http://target-service:3000/api/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'custom' })
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.json();
});
```

### 5. Database Operations with Service Tags

```typescript
import { databaseTracer } from '@smile-health/lib/tracing';

// Traced database query
const users = await databaseTracer.traceQuery(
  'SELECT',
  'SELECT * FROM users WHERE status = ?',
  ['active']
)(async () => {
  // Your actual database query here
  return await db.query('SELECT * FROM users WHERE status = ?', ['active']);
});
```

### 6. Redis Operations with Service Tags

```typescript
import { redisTracer } from '@smile-health/lib/tracing';

// Traced Redis operations
await redisTracer.traceOperation('set', 'user:123', userData)(async () => {
  return await redis.set('user:123', JSON.stringify(userData));
});

const cachedUser = await redisTracer.traceOperation('get', 'user:123')(async () => {
  return await redis.get('user:123');
});
```

## Environment Variables

Configure your service using these environment variables:

```bash
# Service Identification
APP_NAME=core-service              # Service name
APP_VERSION=1.0.0                  # Service version
NODE_ENV=production                  # Environment
HOSTNAME=pod-123                     # Instance identifier

# Service Endpoints (for inter-service calls)
AUTH_SERVICE_URL=http://auth-service:3000
WAREHOUSE_SERVICE_URL=http://warehouse-service:3001
NOTIFICATION_SERVICE_URL=http://notification-service:3002
CORE_SERVICE_URL=http://core-service:3003

# OpenTelemetry Configuration
OTLP_ENABLED=true                    # Enable/disable tracing
OTLP_ENDPOINT=http://localhost:4318  # OTLP collector endpoint
OTLP_PROTOCOL=http                   # Protocol: http or grpc
```

## Inter-Service Call Headers

When services communicate, the following headers are automatically added:

- `X-Service-Source`: Source service name
- `X-Service-Target`: Target service name
- `X-Service-Operation`: Operation being performed
- `X-Request-ID`: Unique request identifier for correlation

## Tracing in Jaeger/Grafana

### Service Identification
Filter spans by service tags:
- `service.name="core-service"`
- `service.environment="production"`
- `service.namespace="smile-platform"`

### Inter-Service Calls
Find inter-service communication:
- `inter.service.source="auth-service"`
- `inter.service.target="warehouse-service"`
- `span.kind="client"` (outgoing calls)
- `span.kind="server"` (incoming calls)

### Performance Analysis
Analyze inter-service performance:
- `inter.service.duration_ms > 1000` (slow calls)
- `inter.service.success=false` (failed calls)
- `inter.service.error="*timeout*"` (timeout errors)

## Best Practices

### 1. Service Naming
- Use descriptive, consistent service names
- Include environment in service identification
- Keep names stable across deployments

### 2. Inter-Service Calls
- Always use the traced HTTP client for service-to-service calls
- Register all service endpoints in the ServiceRegistry
- Handle inter-service call failures gracefully

### 3. Error Handling
- Inter-service call errors are automatically traced
- Include meaningful error messages for debugging
- Use appropriate HTTP status codes

### 4. Performance
- Inter-service calls add minimal overhead
- Context propagation is automatic
- Database and Redis operations maintain existing performance

## Migration Guide

### From Basic Tracing
1. Update your service configuration to use `quickSetupService()`
2. Replace direct `fetch()` calls with `tracedHTTPClient`
3. Register service dependencies and endpoints
4. Update environment variables for service identification

### Gradual Migration
1. Start with service tagging on existing spans
2. Add inter-service call tracking for new features
3. Gradually migrate existing service calls
4. Update monitoring and alerting to use new tags

## Troubleshooting

### Missing Service Tags
- Check that `APP_NAME` environment variable is set
- Verify service configuration is applied before routes
- Ensure tracing middleware is applied in correct order

### Inter-Service Calls Not Traced
- Verify service endpoints are registered
- Check that `tracedHTTPClient` is used for calls
- Ensure target services have tracing middleware

### Context Propagation Issues
- Check that all services use the same tracing configuration
- Verify HTTP headers are not being stripped by proxies
- Ensure request IDs are preserved across services

## Examples

See `tracing-usage-example.ts` for comprehensive examples of all features.