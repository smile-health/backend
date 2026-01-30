# @smile-health/lib

A comprehensive TypeScript library providing shared utilities, database management, tracing, caching, Excel processing, RabbitMQ messaging, and feature flags for the Smile platform.

## 📦 Installation

```bash
# Using pnpm (recommended)
pnpm add @smile-health/lib

# Using npm
npm install @smile-health/lib

# Using yarn
yarn add @smile-health/lib
```

## 🔧 Dependencies

This package requires the following dependencies:

- **Runtime Dependencies**: See `package.json` for full list
- **Development Dependencies**: TypeScript, Bun runtime
- **Peer Dependencies**: None

## 📚 Table of Contents

1. [Database Management](#database-management)
2. [Error Handling](#error-handling)
3. [Excel Processing](#excel-processing)
4. [RabbitMQ Messaging](#rabbitmq-messaging)
5. [Caching](#caching)
6. [Feature Flags](#feature-flags)
7. [Tracing](#tracing)
8. [Utilities](#utilities)
9. [Types](#types)
10. [Middleware](#middleware)

---

## Database Management

### DatabaseManager

A Kysely-based database manager for TypeScript-first SQL queries.

**Purpose**: Provides a type-safe database interface with JSON parsing support.

**Constructor Parameters**:
- `dialect: Dialect` - Database dialect configuration
- `debug: boolean` - Enable query and error logging

**Public Methods**:
- `getDB(): Kysely<DB>` - Returns the Kysely database instance

**Example Usage**:
```typescript
import { DatabaseManager } from '@smile-health/lib/database.js';
import { MysqlDialect } from 'kysely';

const dialect = new MysqlDialect({
  // connection config
});

const dbManager = new DatabaseManager(dialect, true);
const db = dbManager.getDB();
```

### TransactionManager

Manages database transactions with automatic rollback on errors.

**Purpose**: Provides a clean interface for database transactions.

**Constructor Parameters**:
- `db: Kysely<DB>` - Kysely database instance

**Public Methods**:
- `async transaction<T>(callback: (trx: Transaction<DB>) => Promise<T>): Promise<T>` - Execute code within a transaction

**Example Usage**:
```typescript
import { TransactionManager } from '@smile-health/lib/database.js';

const trxManager = new TransactionManager(db);

await trxManager.transaction(async (trx) => {
  await trx.insertInto('users').values({ name: 'John' }).execute();
  await trx.insertInto('profiles').values({ userId: 1 }).execute();
});
```

### BaseRepository

Abstract base class for database repositories with common CRUD operations.

**Purpose**: Provides standardized database operations with soft delete and audit support.

**Constructor Parameters**:
- `tableName: TableName` - Name of the database table
- `useSoftDelete: boolean` (optional, default: true) - Enable soft delete functionality
- `useAudit: boolean` (optional, default: true) - Enable audit fields (created_by, updated_by)

**Public Methods**:
- `async find(c: Context, where: Partial<Record<keyof DB[TableName], any>>): Promise<DB[TableName][]>` - Find multiple records
- `async findOne(c: Context, where: Partial<Record<keyof DB[TableName], any>>): Promise<DB[TableName] | undefined>` - Find single record
- `async create(c: Context, data: Partial<Record<keyof DB[TableName], any>>): Promise<InsertResult>` - Create new record
- `async update(c: Context, data: Partial<Record<keyof DB[TableName], any>>, where: Partial<Record<keyof DB[TableName], any>>): Promise<UpdateResult>` - Update records
- `async delete(c: Context, where: Partial<Record<keyof DB[TableName], any>>): Promise<DeleteResult>` - Soft delete records (if enabled)

**Example Usage**:
```typescript
import { BaseRepository } from '@smile-health/lib/base/repository.js';

class UserRepository extends BaseRepository<Database, 'users'> {
  constructor() {
    super('users', true, true);
  }
}

const userRepo = new UserRepository();
const users = await userRepo.find(c, { status: 'active' });
```

---

## Error Handling

### HTTPError

Base class for all HTTP errors.

**Purpose**: Provides structured error handling with HTTP status codes.

**Constructor Parameters**:
- `message: string` - Error message
- `statusCode: ContentfulStatusCode` - HTTP status code

**Properties**:
- `statusCode: ContentfulStatusCode` - HTTP status code
- `name: string` - Error class name

### Specific Error Classes

#### BadRequestError (400)
```typescript
throw new BadRequestError("Invalid input data");
```

#### UnauthorizedError (401)
```typescript
throw new UnauthorizedError("Authentication required");
```

#### ForbiddenError (403)
```typescript
throw new ForbiddenError("Insufficient permissions");
```

#### NotFoundError (404)
```typescript
throw new NotFoundError("Resource not found");
```

#### ValidationError (422)
```typescript
throw new ValidationError("Data validation failed");
```

### errorHandler

Global error handler for Hono applications.

**Purpose**: Centralized error handling with proper HTTP responses.

**Parameters**:
- `err: unknown` - The error to handle
- `c: Context` - Hono context

**Returns**: `Response` - HTTP error response

**Example Usage**:
```typescript
import { errorHandler } from '@smile-health/lib/error.js';

app.onError((err, c) => {
  return errorHandler(err, c);
});
```

---

## Excel Processing

### BaseTemplate

Base class for Excel file processing with multiple processor support.

**Purpose**: Provides unified interface for Excel operations using different processing libraries.

**Constructor Parameters**:
- `startRow: number` (optional, default: 14) - Starting row for data
- `startSheet: number` (optional, default: 1) - Starting sheet index
- `processor: PROCESSOR` (optional, default: PROCESSOR.SHEETJS) - Excel processor to use

**Public Methods**:
- `setLanguage(lang: string): void` - Set language for localization
- `setLanguageByFileName(fileName: string): void` - Auto-detect language from filename
- `async generate(data: any[]): Promise<ArrayBuffer>` - Generate Excel file
- `async load(buffer: ArrayBuffer): Promise<void>` - Load Excel from buffer
- `async loadFromFile(path: string): Promise<void>` - Load Excel from file

**Example Usage**:
```typescript
import BaseTemplate from '@smile-health/lib/excel/index.js';
import { PROCESSOR } from '@smile-health/lib/excel/types.js';

class UserTemplate extends BaseTemplate {
  constructor() {
    super(14, 1, PROCESSOR.EXCELJS);
  }
  
  generate(users: User[]) {
    // Implementation
  }
}
```

### WarehouseTemplate

Specialized template for warehouse operations.

**Purpose**: Pre-configured Excel template for warehouse reports and data exports.

**Constructor Parameters**:
- `startRow: number` (optional, default: 14) - Starting row for data
- `startSheet: number` (optional, default: 1) - Starting sheet index

**Public Methods**:
- Inherits all methods from BaseTemplate
- Additional warehouse-specific formatting and styling

### MultiSheetZipExporter

Exports multiple Excel sheets as a ZIP file with MinIO integration.

**Purpose**: Handles large dataset exports across multiple files and sheets.

**Constructor Parameters**:
- `options: MultiSheetZipExportOptions` - Export configuration

**Key Options**:
- `minioClient: Client` - MinIO client instance
- `bucketName: string` - MinIO bucket name
- `title: string` - Export title
- `processorType: PROCESSOR` - Excel processor type
- `timezone: string` - Timezone for date formatting
- `language: string` - Language for localization

**Public Methods**:
- `async export(data: FileGroup[]): Promise<string>` - Export data and return MinIO URL

**Example Usage**:
```typescript
import { MultiSheetZipExporter } from '@smile-health/lib/excel/multi-sheet-zip.js';

const exporter = new MultiSheetZipExporter({
  minioClient,
  bucketName: 'exports',
  title: 'Monthly Report',
  processorType: PROCESSOR.EXCELJS,
  timezone: 'Asia/Jakarta',
  language: 'id'
});

const fileUrl = await exporter.export(fileGroups);
```

---

## RabbitMQ Messaging

### Publisher

RabbitMQ message publisher with connection management.

**Purpose**: Reliable message publishing with automatic connection handling and chunking for large messages.

**Constructor Parameters**:
- `getConnection: GetConnection` - Function that returns RabbitMQ connection

**Public Methods**:
- `async publish<T>(exchange: string, message: T, type: string = "fanout"): Promise<void>` - Publish message to exchange
- `async publishBatch<T>(exchange: string, messages: T[], type: string = "fanout"): Promise<void>` - Publish multiple messages

**Example Usage**:
```typescript
import { Publisher } from '@smile-health/lib/rabbitmq/publisher.js';

const publisher = new Publisher(async () => {
  return await amqp.connect(connectionString);
});

await publisher.publish('user.events', { id: 1, name: 'John' });
```

### Consumer

RabbitMQ message consumer with transaction support.

**Purpose**: Reliable message consumption with automatic acknowledgment and error handling.

**Constructor Parameters**:
- `getConnection: GetConnection` - Function that returns RabbitMQ connection

**Public Methods**:
- `async consume(queueName: string, handler: Handler<DB>, options?: ConsumeOptions): Promise<void>` - Start consuming messages

**Example Usage**:
```typescript
import { Consumer } from '@smile-health/lib/rabbitmq/consumer.js';

const consumer = new Consumer(getConnection);

await consumer.consume('user.queue', async (c, msg) => {
  const data = JSON.parse(msg);
  await processUserData(c, data);
});
```

### TOPIC

Predefined RabbitMQ topic constants.

**Usage**:
```typescript
import { TOPIC } from '@smile-health/lib/rabbitmq/topic.js';

await publisher.publish(TOPIC.USER_CREATED, userData);
```

Available topics include:
- `USER_CREATED`, `USER_UPDATED`, `USER_DELETED`
- `ORDER_CREATED`, `ORDER_UPDATED`, `ORDER_CANCELLED`
- `STOCK_UPDATED`, `STOCK_LOW`, `STOCK_OUT`
- And many more...

---

## Caching

### TokenCache

Redis-based caching for authentication tokens and user data.

**Purpose**: High-performance caching for authentication and user-related data.

**Constructor Parameters**:
- `config: CacheConfig` - Cache configuration
- `servicePrefix: string` (optional, default: 'auth') - Prefix for cache keys

**CacheConfig Properties**:
- `redis: Redis` - Redis client instance
- `enableCache: boolean` - Enable/disable caching
- `ttl: number` - Time to live in seconds

**Public Methods**:
- `async getTokenValidation(token: string): Promise<any | null>` - Get cached token validation
- `async setTokenValidation(token: string, validationResult: any): Promise<void>` - Cache token validation
- `async getUser(userId: string): Promise<any | null>` - Get cached user data
- `async setUser(userId: string, userData: any): Promise<void>` - Cache user data
- `async invalidateToken(token: string): Promise<void>` - Remove token from cache
- `async invalidateUser(userId: string): Promise<void>` - Remove user from cache

**Example Usage**:
```typescript
import { TokenCache, createTokenCache } from '@smile-health/lib/cache.js';
import Redis from 'ioredis';

const redis = new Redis({
  host: 'localhost',
  port: 6379
});

const cache = createTokenCache({
  redis,
  enableCache: true,
  ttl: 3600 // 1 hour
});

// Cache token validation
await cache.setTokenValidation(token, validationResult);

// Retrieve from cache
const cached = await cache.getTokenValidation(token);
```

### createTokenCache

Factory function for creating TokenCache instances.

**Parameters**: Same as TokenCache constructor
**Returns**: `TokenCache` - New cache instance

---

## Feature Flags

### featureFlagsMiddleware

Hono middleware for feature flag integration with GrowthBook.

**Purpose**: Provides feature flag context to HTTP requests.

**Parameters**: None

**Example Usage**:
```typescript
import { featureFlagsMiddleware } from '@smile-health/lib';
import { Hono } from 'hono';

const app = new Hono();
app.use('*', featureFlagsMiddleware());

app.get('/api/feature', (c) => {
  const growthbook = c.var.growthbook;
  const isEnabled = growthbook.isOn('new-feature');
  return c.json({ enabled: isEnabled });
});
```

### GrowthBookService

Service for managing GrowthBook feature flag client.

**Purpose**: Centralized feature flag management with caching and user targeting.

**Constructor Parameters**:
- `config: GrowthBookConfig` - GrowthBook configuration

**Public Methods**:
- `async initialize(): Promise<void>` - Initialize the GrowthBook client
- `isOn(featureKey: string): boolean` - Check if feature is enabled
- `getFeatureValue<T>(featureKey: string, defaultValue: T): T` - Get feature value with type safety
- `setAttributes(attributes: Record<string, any>): void` - Set user attributes for targeting

### getGrowthBook

Factory function for getting GrowthBook instance.

**Parameters**:
- `config?: Partial<GrowthBookConfig>` - Optional configuration override

**Returns**: `GrowthBookService` - GrowthBook service instance

---

## Tracing

### HTTPRequestTracer

Traces HTTP requests with OpenTelemetry.

**Purpose**: Automatic request tracing with performance metrics.

**Public Methods**:
- `trace(c: Context, next: Next): Promise<Response>` - Trace HTTP request

**Example Usage**:
```typescript
import { httpRequestTracer } from '@smile-health/lib/tracing.js';

app.use('*', httpRequestTracer.trace);
```

### MiddlewareTracer

Traces middleware execution with OpenTelemetry.

**Purpose**: Performance monitoring for middleware functions.

**Public Methods**:
- `trace(name: string, c: Context, next: Next): Promise<Response>` - Trace middleware execution

### RouteTracer

Traces route handlers with OpenTelemetry.

**Purpose**: Performance monitoring for route handlers.

**Public Methods**:
- `trace(route: string, method: string, handler: Handler): Handler` - Wrap route handler with tracing

### DatabaseTracer

Traces database operations with OpenTelemetry.

**Purpose**: Database query performance monitoring.

**Public Methods**:
- `traceQuery<T>(operation: string, query: () => Promise<T>): Promise<T>` - Trace database query

### TracedDatabaseManager

Database manager with automatic tracing.

**Purpose**: Drop-in replacement for DatabaseManager with tracing.

**Constructor Parameters**: Same as DatabaseManager

### TracedRedisClient

Redis client with automatic tracing.

**Purpose**: Redis operations with performance monitoring.

**Constructor Parameters**:
- `redis: Redis` - Redis client instance
- `serviceName: string` - Service name for tracing

---

## Utilities

### Array/Object Manipulation

#### group
Groups array elements by a field value.

**Parameters**:
- `rows: T[]` - Array to group
- `field: K` - Field to group by

**Returns**: `Record<T[K], T[]>` - Grouped object

```typescript
import { group } from '@smile-health/lib/utils.js';

const users = [{ role: 'admin', name: 'John' }, { role: 'user', name: 'Jane' }];
const grouped = group(users, 'role');
// { admin: [{ role: 'admin', name: 'John' }], user: [{ role: 'user', name: 'Jane' }] }
```

#### associate
Creates an object from array using a field as key.

**Parameters**:
- `rows: T[]` - Array to convert
- `field: K` - Field to use as key

**Returns**: `Record<T[K], T>` - Associated object

```typescript
import { associate } from '@smile-health/lib/utils.js';

const users = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }];
const associated = associate(users, 'id');
// { 1: { id: 1, name: 'John' }, 2: { id: 2, name: 'Jane' } }
```

#### collect
Extracts values from a specific field across all array elements.

**Parameters**:
- `rows: T[]` - Source array
- `field: K` - Field to extract

**Returns**: `T[K][]` - Array of extracted values

```typescript
import { collect } from '@smile-health/lib/utils.js';

const users = [{ id: 1 }, { id: 2 }, { id: 3 }];
const ids = collect(users, 'id'); // [1, 2, 3]
```

### Data Transformation

#### merge
Merges multiple arrays into one.

**Parameters**:
- `...arrays: T[][]` - Arrays to merge

**Returns**: `T[]` - Merged array

```typescript
import { merge } from '@smile-health/lib/utils.js';

const result = merge([1, 2], [3, 4], [5, 6]); // [1, 2, 3, 4, 5, 6]
```

#### pick
Creates new objects with only specified fields.

**Parameters**:
- `rows: T[]` - Source objects
- `fields: K[]` - Fields to keep

**Returns**: `Pick<T, K>[]` - Objects with only picked fields

```typescript
import { pick } from '@smile-health/lib/utils.js';

const users = [{ id: 1, name: 'John', email: 'john@example.com' }];
const picked = pick(users, ['id', 'name']); // [{ id: 1, name: 'John' }]
```

#### flattenToNestedObject
Converts flat object with dot notation keys to nested structure.

**Parameters**:
- `rows: T[]` - Flat objects

**Returns**: `NestedObject[]` - Nested objects

```typescript
import { flattenToNestedObject } from '@smile-health/lib/utils.js';

const flat = [{ 'user.name': 'John', 'user.age': 30 }];
const nested = flattenToNestedObject(flat);
// [{ user: { name: 'John', age: 30 } }]
```

### Validation & Helpers

#### isStringNumbers
Checks if string contains only numbers separated by commas.

**Parameters**:
- `stringOfNumbers: string` - String to validate

**Returns**: `boolean` - True if valid number string

#### convertToBoolean
Converts various formats to boolean.

**Parameters**:
- `value: any` - Value to convert

**Returns**: `boolean` - Converted boolean value

#### getDefaultNumber
Safely converts value to number with fallback.

**Parameters**:
- `value: any` - Value to convert
- `defaultValue: number` (optional, default: 0) - Fallback value

**Returns**: `number` - Converted number or default

#### round
Rounds number to specified decimal places.

**Parameters**:
- `value: number` - Number to round
- `decimal: number` (optional, default: 2) - Decimal places

**Returns**: `number` - Rounded number

---

## Types

### Context Types

#### Context
Hono context with database and custom properties.

```typescript
import { Context } from '@smile-health/lib/types/context.js';

app.get('/users', async (c: Context<Database>) => {
  const users = await c.var.db.selectFrom('users').selectAll().execute();
  return c.json(users);
});
```

#### CustomContext
Extended context class with additional functionality.

**Constructor Parameters**:
- `db: Kysely<DB>` - Database instance
- `accountID: string` - Current account ID
- `workspaceID: string` - Current workspace ID

### Pagination Types

#### PaginationQueriesSchema
Zod schema for pagination query parameters.

```typescript
import { PaginationQueriesSchema } from '@smile-health/lib/types/paginate.js';

const querySchema = PaginationQueriesSchema.extend({
  search: z.string().optional()
});
```

#### PaginatedResponse
Generic paginated response wrapper.

**Constructor Parameters**:
- `params: IPaginationParams` - Pagination parameters
- `data: T[]` - Response data
- `total: number` - Total record count

### Parameter Types

#### IdSchema
Zod schema for ID validation.

```typescript
import { IdSchema } from '@smile-health/lib/types/param.js';

const schema = z.object({
  id: IdSchema
});
```

#### DateSchema
Zod schema for date validation with multiple formats.

---

## Middleware

### BaseMiddleware

Abstract base class for middleware with validation support.

**Purpose**: Provides common middleware functionality and validation helpers.

**Constructor Parameters**: None (abstract class)

### ExcelMiddleware

Middleware for handling Excel file uploads and processing.

**Purpose**: Validates and processes Excel file uploads.

**Public Methods**:
- `handleExport: MiddlewareHandler` - Handles Excel export requests

### TransactionMiddleware

Database transaction middleware for Hono.

**Purpose**: Automatically manages database transactions for route handlers.

**Constructor Parameters**:
- `dbManager: DatabaseManager<DB>` - Database manager instance

**Usage**:
```typescript
import { TransactionMiddleware } from '@smile-health/lib/middlewares/transaction.middleware.js';

app.use('/api/*', new TransactionMiddleware(dbManager).middleware);
```

### RequestMiddleware

Request logging and processing middleware.

**Purpose**: Logs incoming requests and adds request context.

---

## API Integration

### AuthKeycloakService

Service for Keycloak authentication integration.

**Purpose**: Handles user authentication, validation, and management with Keycloak.

**Constructor Parameters**:
- `baseURL: string` - Keycloak server URL

**Public Methods**:
- `async validateToken(token: string): Promise<UserInfo>` - Validate access token
- `async getUser(id: string): Promise<UserInfo>` - Get user by ID
- `async createUser(data: CreateUserData): Promise<UserInfo>` - Create new user
- `async updateUser(id: string, data: UpdateUserData): Promise<UserInfo>` - Update user

### fetchData

Generic HTTP client for API requests.

**Parameters**:
- `endpoint: string` - API endpoint
- `options: RequestInit` (optional) - Fetch options

**Returns**: `Promise<T>` - Parsed response data

---

## Environment Variables

The following environment variables are used by the library:

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost/db

# Redis
REDIS_URL=redis://localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# GrowthBook (Feature Flags)
GROWTHBOOK_API_HOST=https://cdn.growthbook.io
GROWTHBOOK_CLIENT_KEY=your_client_key

# OpenTelemetry (Tracing)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_SERVICE_NAME=your-service-name
```

---

## Best Practices

### 1. Error Handling
Always use the provided error classes for consistent HTTP error responses:
```typescript
// Good
throw new NotFoundError("User not found");

// Avoid
throw new Error("User not found"); // No HTTP status
```

### 2. Database Operations
Use the BaseRepository for standard CRUD operations:
```typescript
class UserRepository extends BaseRepository<Database, 'users'> {
  constructor() {
    super('users');
  }
}
```

### 3. Excel Processing
Choose the right processor based on your needs:
- **SheetJS**: Best for simple operations, good performance
- **ExcelJS**: Best for complex formatting and styling
- **XLSX-Populate**: Best for template-based operations

### 4. Message Publishing
Always use the Publisher class for RabbitMQ messages:
```typescript
const publisher = new Publisher(getConnection);
await publisher.publish('exchange.name', messageData);
```

### 5. Feature Flags
Always check feature flags before enabling new functionality:
```typescript
const growthbook = c.var.growthbook;
if (growthbook.isOn('new-feature')) {
  // New feature code
}
```

---

## Contributing

When adding new functionality to this library:

1. **Maintain Backward Compatibility**: Don't break existing APIs
2. **Add Tests**: Include comprehensive tests for new features
3. **Update Documentation**: Keep this README up to date
4. **Follow Patterns**: Maintain consistency with existing code style
5. **Export Appropriately**: Add exports to relevant index files

---

## License

ISC License - See package.json for details.