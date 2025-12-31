# ETIMEDOUT Error Troubleshooting Guide

This guide helps you identify which service is causing the `ETIMEDOUT` connection error in the sync-service.

## Enhanced Logging Added

The following files have been enhanced with detailed timeout logging:

### 1. Database Connection (`src/common/infrastructure/database/index.ts`)
- ✅ MySQL connection attempts
- ✅ Connection pool events (acquire, release, error)
- ✅ Specific ETIMEDOUT error detection
- ✅ Connection timeout configuration (60 seconds)

### 2. RabbitMQ Connection (`src/common/infrastructure/mq/index.ts`)
- ✅ RabbitMQ connection attempts with 30-second timeout
- ✅ Connection URL logging (without credentials)
- ✅ Specific ETIMEDOUT error detection
- ✅ Connection state management
- ✅ Troubleshooting steps in error messages

### 3. Redis Connection (`src/common/infrastructure/redis.ts`)
- ✅ Redis connection attempts
- ✅ Connection state events (connect, ready, close, reconnecting)
- ✅ Specific ETIMEDOUT error detection
- ✅ Connection timeout configuration (30 seconds)
- ✅ Authentication error detection

### 4. HTTP Requests (`src/index.ts`)
- ✅ Axios timeout error detection
- ✅ External API timeout logging
- ✅ Request details logging
- ✅ Worker startup error handling

## How to Use the Enhanced Logging

1. **Start the sync-service**:
   ```bash
   cd /c/laragon/www/platform-backend2/apps/sync-service
   npm run dev
   ```

2. **Watch the console output** for these indicators:

   ### MySQL Issues:
   ```
   🔌 Attempting to connect to MySQL database at localhost:3306/dbname...
   ❌ MySQL connection error to localhost:3306: connect ETIMEDOUT
   ⏰ MySQL connection TIMEOUT to localhost:3306 - Check if MySQL server is running and accessible
   ```

   ### RabbitMQ Issues:
   ```
   🔌 Attempting to connect to RabbitMQ at amqp://localhost:5672...
   ❌ Failed to connect to RabbitMQ at localhost:5672: connect ETIMEDOUT
   ⏰ RabbitMQ connection TIMEOUT - This is likely the source of your ETIMEDOUT error
   ```

   ### Redis Issues:
   ```
   🔌 Attempting to connect to Redis at localhost:6379...
   ❌ Redis connection error to localhost:6379: connect ETIMEDOUT
   ⏰ Redis connection TIMEOUT - This could be the source of your ETIMEDOUT error
   ```

   ### HTTP API Issues:
   ```
   ⏰ HTTP Request TIMEOUT - External API call timed out
   🔍 Request details: { url: 'http://example.com/api', method: 'GET', timeout: 5000 }
   ```

## Quick Fixes

### 1. Create .env file
```bash
cp .env.example .env
```

### 2. Check Docker Services
```bash
# Check if services are running
docker ps

# Start infrastructure services
docker-compose -f ../../infra/compose-database.yml up -d
docker-compose -f ../../infra/compose-message.yml up -d
```

### 3. Test Individual Connections

**MySQL:**
```bash
mysql -h localhost -P 3306 -u your_user -p
```

**RabbitMQ:**
```bash
# Check if RabbitMQ is accessible
curl -u guest:guest http://localhost:15672/api/overview
```

**Redis:**
```bash
redis-cli -h localhost -p 6379 ping
```

## Environment Configuration

Ensure your `.env` file has correct values:

```env
# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PORT=3306
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# RabbitMQ
RABBITMQ_PROTOCOL=amqp
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=guest
RABBITMQ_PASSWORD=guest

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## Common Issues and Solutions

| Error Pattern | Likely Cause | Solution |
|---------------|--------------|----------|
| `MySQL connection TIMEOUT` | MySQL server not running | Start MySQL: `docker-compose up mysql` |
| `RabbitMQ connection TIMEOUT` | RabbitMQ server not running | Start RabbitMQ: `docker-compose up rabbitmq` |
| `Redis connection TIMEOUT` | Redis server not running | Start Redis: `docker-compose up redis` |
| `HTTP Request TIMEOUT` | External API unreachable | Check network/API endpoint |
| `WORKER STARTUP TIMEOUT` | Multiple services down | Check all infrastructure services |

## Next Steps

1. Run the sync-service with the enhanced logging
2. Identify which service is timing out from the console output
3. Follow the specific troubleshooting steps provided in the error messages
4. Ensure all required services are running and accessible
5. Verify your `.env` configuration matches your actual service setup