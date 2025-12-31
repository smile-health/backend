# Enhanced Infrastructure Observability

This document outlines the enhanced observability features implemented across all services in the platform backend. Each infrastructure component now includes comprehensive monitoring, logging, and health checking capabilities.

## New Features

### 1. Message Queue (RabbitMQ)
- **Connection Status Tracking**: Real-time status monitoring (`disconnected`, `connecting`, `connected`, `error`)
- **Enhanced Logging**: Connection attempts, reusability, errors, and closures
- **Connection Timeout**: 30-second timeout for connection attempts
- **Health Check Function**: `healthCheck()` - Tests connection liveness
- **Status Getter**: `getConnectionStatus()` - Returns current connection state

### 2. Redis
- **Connection Status Tracking**: Real-time status monitoring (`disconnected`, `connecting`, `connected`, `error`)
- **Event Logging**: Connect, ready, error, close, and reconnecting events
- **Health Check Function**: `healthCheck()` - Uses `ping` command to test connection
- **Status Getter**: `getConnectionStatus()` - Returns current connection state

### 3. Databases
- **Connection Status Tracking**: Real-time status monitoring for all database connections
- **Initialization Logging**: Database connection setup and configuration logging
- **Health Check Function**: `healthCheck()` - Executes simple queries to test connectivity
- **Status Getter**: `getConnectionStatus()` - Returns current connection state

### 4. MinIO Storage
- **Connection Status Tracking**: Real-time status monitoring (`disconnected`, `connecting`, `connected`, `error`)
- **Enhanced Client Creation**: Centralized client creation with monitoring capabilities
- **Health Check Function**: `healthCheck()` - Tests connection by listing buckets
- **Status Getter**: `getConnectionStatus()` - Returns current connection state
- **Shared Library**: Centralized MinIO client creation in `@smile/lib/minio.js`

### 5. Elasticsearch
- **Connection Status Tracking**: Real-time status monitoring (`disconnected`, `connecting`, `connected`, `error`)
- **Initialization Logging**: Client setup and configuration logging
- **Health Check Function**: `healthCheck()` - Uses `ping` to test Elasticsearch connectivity
- **Status Getter**: `getConnectionStatus()` - Returns current connection state

### 6. ClickHouse
- **Connection Status Tracking**: Real-time status monitoring (`disconnected`, `connecting`, `connected`, `error`)
- **Initialization Logging**: Client setup and configuration logging
- **Health Check Function**: `healthCheck()` - Executes simple test queries
- **Status Getter**: `getConnectionStatus()` - Returns current connection state
- **Error Tracking**: Enhanced error handling in query execution

## Services Coverage

### Main Service (`apps/main`)
- ✅ Redis (`src/common/infrastructure/redis.ts`)
- ✅ RabbitMQ (`src/common/infrastructure/mq/index.ts`)
- ✅ ClickHouse Datamart (`src/common/infrastructure/database/datamart.ts`)
- ✅ ClickHouse Slave (`src/common/infrastructure/database/slave.ts`)
- ✅ Elasticsearch (`src/common/infrastructure/elastic/index.ts`)

### Core Service (`apps/core`)
- ✅ Redis (`src/common/infrastructure/redis.ts`)
- ✅ RabbitMQ (`src/common/infrastructure/mq/index.ts`)
- ✅ MinIO (`src/common/infrastructure/minio.ts`)

### Warehouse Service (`apps/warehouse-service`)
- ✅ Redis (`src/common/infrastructure/redis.ts`)
- ✅ MySQL (`src/common/infrastructure/database/mysql/index.ts`)
- ✅ ClickHouse Slave (`src/common/infrastructure/database/slave.ts`)
- ✅ ClickHouse (`src/common/infrastructure/database/clickhouse/index.ts`)

### Sync Service (`apps/sync-service`)
- ✅ RabbitMQ (`src/common/infrastructure/mq/index.ts`)

### Shared Libraries (`packages/lib`)
- ✅ MinIO Client (`minio.ts`) - Enhanced with monitoring
- ✅ Infrastructure Monitor (`infrastructure-monitor.ts`) - Centralized monitoring

## Quick Start

### Individual Component Health Check

```typescript
// Redis health check
import { healthCheck, getConnectionStatus } from './src/common/infrastructure/redis.js';

const isHealthy = await healthCheck();
const status = getConnectionStatus();
console.log(`Redis Status: ${status}, Healthy: ${isHealthy}`);

// Database health check
import { healthCheck, getConnectionStatus } from './src/common/infrastructure/database/datamart.js';

const isHealthy = await healthCheck();
const status = getConnectionStatus();
console.log(`Database Status: ${status}, Healthy: ${isHealthy}`);

// MinIO health check
import { healthCheck, getConnectionStatus } from './src/common/infrastructure/minio.js';

const isHealthy = await healthCheck();
const status = getConnectionStatus();
console.log(`MinIO Status: ${status}, Healthy: ${isHealthy}`);
```

### Centralized Monitoring

```typescript
import { setupAllServicesMonitoring, generateInfrastructureReport } from '../examples/infrastructure-monitoring-usage.js';

// Setup monitoring for all services
const monitor = setupAllServicesMonitoring();

// Generate comprehensive report
await generateInfrastructureReport();

// Start periodic monitoring (every 30 seconds)
monitor.startPeriodicHealthCheck(30000);
```

### Express.js Health Endpoint

```typescript
import express from 'express';
import { createHealthCheckEndpoint } from '../examples/infrastructure-monitoring-usage.js';

const app = express();

// Add health check endpoint
app.get('/health', createHealthCheckEndpoint());

app.listen(3000, () => {
  console.log('Health check endpoint available at http://localhost:3000/health');
});
```

## API Reference

### Connection Status Types

```typescript
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
```

### Common Interface

All infrastructure components implement:

```typescript
interface InfrastructureComponent {
  getConnectionStatus(): ConnectionStatus;
  healthCheck(): Promise<boolean>;
}
```

### Infrastructure Monitor

```typescript
class InfrastructureMonitor {
  registerComponent(id: string, name: string, healthCheck: () => Promise<boolean>, getStatus: () => ConnectionStatus): void;
  getConnectionStatuses(): Record<string, ConnectionStatus>;
  runHealthChecks(): Promise<Record<string, HealthCheckResult>>;
  getInfrastructureSummary(): Promise<InfrastructureSummary>;
  startPeriodicHealthCheck(intervalMs: number): void;
  stopPeriodicHealthCheck(): void;
}
```

## Configuration Examples

### Environment Variables

```bash
# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# MySQL
DATABASE_URL=mysql://user:password@localhost:3306/database

# ClickHouse
CLICKHOUSE_DATABASE_URL=http://user:password@localhost:8123/database

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false

# Elasticsearch
ES_HOST=http://localhost:9200
ES_USERNAME=elastic
ES_PASSWORD=password
```

### Docker Compose Health Checks

```yaml
version: '3.8'
services:
  main-service:
    build: ./apps/main
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  core-service:
    build: ./apps/core
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Monitoring Best Practices

### 1. Graceful Degradation
- Services should continue operating even if non-critical components fail
- Implement circuit breakers for external dependencies
- Use fallback mechanisms where possible

### 2. Alerting Strategy
- Set up alerts for critical component failures
- Use different severity levels (warning, error, critical)
- Implement escalation policies

### 3. Logging Standards
- Use structured logging with consistent formats
- Include correlation IDs for request tracing
- Log infrastructure events with appropriate severity levels

### 4. Performance Monitoring
- Monitor connection pool usage
- Track query execution times
- Monitor memory and CPU usage

### 5. Regular Health Checks
- Implement both active and passive health checks
- Use appropriate check intervals (not too frequent to avoid overhead)
- Include dependency checks in health endpoints

## Troubleshooting

### Common Issues

1. **Connection Timeouts**
   - Check network connectivity
   - Verify firewall rules
   - Increase timeout values if necessary

2. **Authentication Failures**
   - Verify credentials in environment variables
   - Check user permissions
   - Ensure certificates are valid

3. **Resource Exhaustion**
   - Monitor connection pool limits
   - Check memory usage
   - Review query performance

### Debug Mode

Enable debug logging by setting:

```bash
LOG_MODE=development
DEBUG=true
```

## Migration Guide

### Updating Existing Code

1. **Import New Functions**
   ```typescript
   // Old
   import redis from './redis.js';
   
   // New
   import redis, { healthCheck, getConnectionStatus } from './redis.js';
   ```

2. **Add Health Checks to Routes**
   ```typescript
   app.get('/health', async (req, res) => {
     const redisHealthy = await healthCheck();
     res.json({ redis: redisHealthy });
   });
   ```

3. **Use Centralized Monitoring**
   ```typescript
   import { setupAllServicesMonitoring } from '../examples/infrastructure-monitoring-usage.js';
   
   const monitor = setupAllServicesMonitoring();
   monitor.startPeriodicHealthCheck(30000);
   ```

## Benefits

### Real-time Visibility
- Instant awareness of infrastructure health
- Proactive issue detection
- Reduced mean time to resolution (MTTR)

### Operational Excellence
- Standardized monitoring across all services
- Consistent logging and error handling
- Improved debugging capabilities

### Reliability
- Early warning system for potential failures
- Better understanding of system dependencies
- Enhanced incident response capabilities

### Scalability
- Centralized monitoring infrastructure
- Easy addition of new components
- Flexible alerting and reporting

---

*This infrastructure monitoring system provides comprehensive observability across all platform services, enabling proactive maintenance and rapid issue resolution.*