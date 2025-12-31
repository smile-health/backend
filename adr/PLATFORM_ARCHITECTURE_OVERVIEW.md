# SMILE Platform Architecture Documentation

## Overview

This document provides a comprehensive overview of the SMILE Platform architecture, consolidating information from various architecture decision records (ADRs) and technical documentation. The platform follows a microservices architecture with multiple services working together to provide a complete healthcare supply chain management solution.

## Architecture Components

### Core Services

#### 1. Main Service (`apps/main`)
- **Port**: 3004
- **Purpose**: Primary business logic and API endpoints
- **Database**: MySQL, ClickHouse (Datamart & Slave)
- **Infrastructure**: Redis, RabbitMQ, Elasticsearch
- **Key Features**: 
  - Core business operations
  - Data analytics and reporting
  - Integration with external systems

#### 2. Core Service (`apps/core`)
- **Port**: 3000
- **Purpose**: Foundation services and shared utilities
- **Database**: Redis, RabbitMQ
- **Infrastructure**: MinIO (object storage)
- **Key Features**:
  - Authentication and authorization
  - File storage and management
  - Common utilities and helpers

#### 3. Auth Service (`apps/auth-service`)
- **Port**: 3003
- **Purpose**: Authentication and user management
- **Key Features**:
  - JWT-based authentication
  - User session management
  - Role-based access control

#### 4. Warehouse Service (`apps/warehouse-service`)
- **Port**: 3006
- **Purpose**: Inventory and warehouse management
- **Database**: MySQL, ClickHouse
- **Infrastructure**: Redis
- **Key Features**:
  - Stock management
  - Batch tracking
  - Inventory transactions

#### 5. Sync Service (`apps/sync-service`)
- **Purpose**: Data synchronization and migration
- **Infrastructure**: RabbitMQ
- **Key Features**:
  - Data migration from SMILE 3.0 to 5.0
  - Cross-service data synchronization
  - Background job processing

### Legacy API Services (v3.0)

#### 6. Main API v3.0 (`apps/3.0/main-api`)
- **Port**: 3007
- **Purpose**: Legacy API compatibility layer

#### 7. Warehouse API v3.0 (`apps/3.0/warehouse-api`)
- **Port**: 3009
- **Purpose**: Legacy warehouse API compatibility

#### 8. IoT API (`apps/3.0/iot-api`)
- **Purpose**: IoT device integration and data collection

#### 9. Notification Service (`apps/3.0/notification`)
- **Purpose**: Push notifications and alerts

## Infrastructure Components

### Database Layer

#### MySQL
- **Primary database** for transactional data
- **Services**: Main, Warehouse
- **Connection**: Managed through Kysely query builder
- **Monitoring**: Health checks and connection pooling

#### ClickHouse
- **Analytics database** for reporting and data warehousing
- **Services**: Main, Warehouse
- **Types**: Datamart (analytics), Slave (reporting)
- **Use Cases**: Dashboard data, analytics queries

#### Redis
- **Caching layer** and session storage
- **Services**: Core, Main, Warehouse
- **Features**: Connection pooling, health monitoring

### Message Queue & Communication

#### RabbitMQ
- **Message broker** for inter-service communication
- **Services**: Core, Main, Sync
- **Features**: Reliable messaging, queue management

### Storage & File Management

#### MinIO
- **Object storage** for files and documents
- **Services**: Core
- **Features**: S3-compatible API, health monitoring

### Search & Analytics

#### Elasticsearch
- **Search engine** for advanced querying
- **Services**: Main
- **Use Cases**: Full-text search, data indexing

## Shared Libraries (`packages/lib`)

### Core Utilities (`@smile/lib`)

#### Database Management (`database.ts`)
- **TransactionManager**: Database transaction handling
- **DatabaseManager**: Kysely database instance management
- **Features**: Type-safe queries, connection pooling

#### Error Handling (`error.ts`, `error-excel.ts`)
- **HTTPError**: Base HTTP error classes (400, 401, 403, 404, 422)
- **ExcelError**: Excel-specific error handling
- **Features**: Standardized error responses

#### Excel Processing (`excel.ts`)
- **ExportTemplate**: Excel file generation
- **ImportTemplate**: Excel file parsing
- **Features**: Data formatting, styling, validation

#### Internationalization (`i18n.ts`)
- **i18next integration** with Tolgee API
- **Features**: Multi-language support, dynamic translation loading

#### Logging (`logger.ts`)
- **Pino-based logging** with Loki integration
- **Features**: Structured logging, HTTP request logging

#### Tracing (`tracing.ts`)
- **OpenTelemetry integration** for distributed tracing
- **Features**: Auto-instrumentation, OTLP export

#### Utilities (`utils.ts`)
- **Data manipulation functions**: group, associate, collect, merge
- **Validation functions**: string validation, date comparison
- **Type conversion**: boolean, number formatting

## API Architecture

### Authentication
- **JWT-based authentication** with refresh tokens
- **Login endpoint**: `POST /auth/login`
- **Token usage**: Bearer token in Authorization header
- **Token lifecycle**: Automatic refresh on expiration

### API Standards
- **Content-Type**: application/json
- **Error format**: Standardized error responses
- **Pagination**: Cursor-based pagination
- **Rate limiting**: Service-specific limits

### Testing Guidelines
- **Framework**: Mocha + Chai
- **Coverage**: NYC (Istanbul)
- **Principles**: API-only testing, no direct database access
- **Authentication**: Required for all protected endpoints

## Data Migration (SMILE 3.0 → 5.0)

### Migration Strategy
- **17 migration scripts** organized in 5 phases
- **Batch processing** with configurable sizes
- **Progress tracking** using Redis
- **Rollback capabilities** for failed migrations

### Migration Phases

#### Phase 1: Foundation Data (Global)
- Locations (geographic hierarchy)
- Activities (program activities)
- Manufactures (manufacturer data)
- Budget Sources (funding sources)

#### Phase 2: Core Entities
- Users (user accounts)
- Entities (business entities)
- Materials (material catalog)

#### Phase 3: Workspace Relations
- Entity Relations (business associations)
- Material Relations (product associations)
- Patients (patient records)

#### Phase 4: Operational Data
- Batches (material batches)
- Stocks (inventory data)
- Orders (order management)
- Transactions (financial data)

#### Phase 5: Supporting Data
- Stock Opnames (inventory counts)
- Reconciliations (data reconciliation)
- Transaction Reasons (metadata)

### Migration Commands
```bash
# Complete migration
npm run migrate:all

# Individual migrations
npm run migrate:location
npm run migrate:user-bulk
npm run migrate:entity-bulk
```

## Infrastructure Monitoring

### Health Checks
All services implement standardized health check endpoints:
- **Database connectivity**: MySQL, ClickHouse, Redis
- **Message queue status**: RabbitMQ
- **Storage accessibility**: MinIO
- **External service availability**: API endpoints

### Connection Status Tracking
- **Real-time monitoring** of all infrastructure components
- **Status types**: disconnected, connecting, connected, error
- **Health check functions**: Component-specific validation
- **Centralized monitoring**: InfrastructureMonitor class

### Logging & Observability
- **Structured logging** with correlation IDs
- **Distributed tracing** with OpenTelemetry
- **Metrics collection** for performance monitoring
- **Error tracking** and alerting

## Service Status Dashboard

### Environment Status
- **Staging Environment**: All services running ✅
- **Development Environment**: All services running ✅

### Infrastructure Services
| Service       | Status     |
| ------------- | ---------- |
| MySQL         | ✅ running |
| ClickHouse    | ✅ running |
| Redis         | ✅ running |
| RabbitMQ      | ✅ running |
| MinIO Storage | ✅ running |
| Keycloak      | ✅ running |
| Translation   | ✅ running |

## Development Guidelines

### Code Standards
- **TypeScript** for type safety
- **ESLint** for code quality
- **Prettier** for code formatting
- **Conventional commits** for version control

### Testing Requirements
- **Unit tests**: Minimum 80% coverage
- **Integration tests**: API endpoint validation
- **End-to-end tests**: Critical user flows
- **Performance tests**: Load and stress testing

### Deployment Process
- **Docker containerization** for all services
- **Docker Compose** for local development
- **CI/CD pipeline** with GitLab CI
- **Environment-specific** configurations

## Troubleshooting

### Common Issues
1. **Connection timeouts**: Check service availability and network
2. **Authentication failures**: Verify token validity and permissions
3. **Database errors**: Check connection strings and permissions
4. **Memory issues**: Monitor resource usage and optimize queries

### Debug Mode
```bash
# Enable debug logging
LOG_MODE=development
DEBUG=true
```

### Health Check Commands
```bash
# Test individual connections
mysql -h localhost -P 3306 -u user -p
redis-cli -h localhost -p 6379 ping
curl -u guest:guest http://localhost:15672/api/overview
```

## Security Considerations

### Authentication & Authorization
- **JWT tokens** with appropriate expiration
- **Role-based access control** (RBAC)
- **API key management** for external integrations
- **Session management** with Redis

### Data Protection
- **Encryption at rest** for sensitive data
- **HTTPS enforcement** for all communications
- **Input validation** and sanitization
- **SQL injection prevention** with parameterized queries

### Infrastructure Security
- **Network segmentation** between services
- **Secret management** with environment variables
- **Container security** best practices
- **Regular security updates** and patches

---

**Last Updated**: January 2025  
**Version**: 2.0  
**Maintainer**: Platform Team  
**Next Review**: March 2025