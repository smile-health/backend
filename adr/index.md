# Architecture Documentation Index

This directory organizes all architecture and design documentation for the **SMILE Platform** — healthcare supply chain management system.

> **Last updated:** Juni 2026
> **Source:** [github.com/smile-health/backend](https://github.com/smile-health/backend)

---

## 🏛️ Platform Architecture

| Doc | Description |
|-----|-------------|
| [Platform Architecture Overview](PLATFORM_ARCHITECTURE_OVERVIEW.md) | Full architecture — services, infrastructure, shared libs, API standards |
| [Service Statuses](SERVICE_STATUSES.md) | Environment status dashboard (staging, dev) |
| [Shared Packages Overview](shared-packages.md) | `@smile-health/lib` shared library documentation |
| [`@smile-health/lib` Documentation](lib-documentation.md) | Detailed shared lib API docs |

### Diagrams (C4 Model)

- [System Context](diagrams/system-context.md) — High-level system context
- [Container Diagram](diagrams/containers.md) — Service containers & dependencies
- [Core Service Components](diagrams/core-components.md)
- [Main Service Components](diagrams/main-components.md)
- [Auth Service Components](diagrams/auth-service-components.md)
- [Warehouse Service Components](diagrams/warehouse-service-components.md)
- [Interaction Overview](diagrams/architecture-beta.md)

---

## 🔐 Authentication

| Doc | Description |
|-----|-------------|
| [Authentication](authentication.md) | JWT, Keycloak, RBAC, session management |

---

## 🔗 Integration

| Doc | Description |
|-----|-------------|
| [SIHA / SITB API v1.0](integration/SIHA_SITB_API_v1.0.md) | Integrasi SIHA & SITB |
| [Biofarma Order — Controller Process (EN)](integration/en/biofarma-order/biofarma-order-controller-process.md) | Flow order Biofarma |
| [Biofarma Order — Controller Process (ID)](integration/id/biofarma-order/biofarma-order-controller-process.md) | Flow order Biofarma (Bahasa) |
| [Biofarma Order — Cron (EN)](integration/en/biofarma-order/biofarma-order-cron.md) | Cron sinkronisasi Biofarma |
| [Biofarma Order — Cron (ID)](integration/id/biofarma-order/biofarma-order-cron.md) | Cron sinkronisasi Biofarma (Bahasa) |
| [Biofarma Order — V3 to V5 (EN)](integration/en/biofarma-order/biofarma-order-v3-to-v5.md) | Migrasi order v3→v5 |
| [Biofarma Order — V3 to V5 (ID)](integration/id/biofarma-order/biofarma-order-v3-to-v5.md) | Migrasi order v3→v5 (Bahasa) |

---

## 📊 Dashboards & Reporting

| Doc | Description |
|-----|-------------|
| [AbnormalStock API](dashboards/AbnormalStock-API.md) | Monitoring stok abnormal |
| [ConsumptionSupply API](dashboards/ConsumptionSupply-API.md) | Konsumsi & pasokan |
| [Count Transaction API](dashboards/COUNT_TRANSACTION_API_DOCUMENTATION.md) | Hitung transaksi |
| [Dashboard Routine API](dashboards/Dashboard-Routine-API.md) | Dashboard rutin |
| [FillingStock API](dashboards/FillingStock-API.md) | Pengisian stok |
| [Monev API](dashboards/Monev-API.md) | Monitoring & evaluasi |
| [Excel Export Endpoints](special-endpoint/excel-endpoints.md) | Special endpoint untuk export Excel |

---

## 🔄 Data Migration (SMILE 3.0 → 5.0)

| Doc | Description |
|-----|-------------|
| [Migration Overview](data-migration-smile3-to-smile5/overview.md) | Strategy & phases |
| [Source-Target Mapping](data-migration-smile3-to-smile5/source-target-database-mapping.md) | Database mapping |
| [Execution Order](data-migration-smile3-to-smile5/migration-execution-order.md) | Script execution sequence |
| [Constants Mapping](data-migration-smile3-to-smile5/constants-mapping.md) | Data constants mapping |

### Global Migrations
- [Activity](data-migration-smile3-to-smile5/global/migrate-activity.md)
- [Budget Source](data-migration-smile3-to-smile5/global/migrate-budget-source.md)
- [Entity Bulk](data-migration-smile3-to-smile5/global/migrate-entity-bulk.md)
- [Location](data-migration-smile3-to-smile5/global/migrate-location.md)
- [Manufacture](data-migration-smile3-to-smile5/global/migrate-manufacture.md)
- [Material](data-migration-smile3-to-smile5/global/migrate-material.md)
- [User Bulk](data-migration-smile3-to-smile5/global/migrate-user-bulk.md)

### Workspace Migrations
- [Batches](data-migration-smile3-to-smile5/workspace/migrate-batches.md)
- [Patients](data-migration-smile3-to-smile5/workspace/migrate-patients.md)
- [Stock Opnames](data-migration-smile3-to-smile5/workspace/migrate-stock-opnames.md)

---

## 🗄️ Database

| Doc | Description |
|-----|-------------|
| [Order Controller Models](databaseModels.md) | Order-related entities |
| [Transaction Controller Models](databaseModelsTransaction.md) | Transaction entities |
| [Core Service Migrations](database-migrations/core.md) | Core DB migration scripts |
| [Main Service Migrations](database-migrations/main.md) | Main DB migration scripts |
| [Sync Service Migrations](database-migrations/sync-service.md) | Sync DB migration scripts |

---

## ⚙️ Infrastructure & Operations

| Doc | Description |
|-----|-------------|
| [Infrastructure Monitoring](INFRASTRUCTURE_MONITORING.md) | Health checks, monitoring setup |
| [Service Statuses](SERVICE_STATUSES.md) | Environment status dashboard |
| [Timeout Troubleshooting](TIMEOUT_TROUBLESHOOTING.md) | Debug timeout issues |

---

## 🚀 Feature Flags

| Doc | Description |
|-----|-------------|
| [Feature Flags Docs](feature-flags/feature-flags-docs.md) | GrowthBook setup & usage |
| [Feature Flags Diagram](feature-flags/feature-flags-diagram.md) | Evaluation flow diagram |

---

## 📝 Development Guides

| Doc | Description |
|-----|-------------|
| [API Testing Guidelines](apitest.md) | Mocha + Chai, API-only testing |
| [Cursor Pagination Guide](cursor-pagination-guide.md) | Cursor-based pagination standard |
| [Version Control Workflow](version-control-workflow.md) | Git branching & commit conventions |

---

## 📋 Product Requirements

| Doc | Description |
|-----|-------------|
| [PRD: Set Material for SO](prd/%5BPRD%5DSetMaterialforSO.md) | Product requirement — material setup for stock opname |

---

## 📚 Additional Docs

| Doc | Description |
|-----|-------------|
| [Documentation Audit](DOCUMENTATION_AUDIT.md) | Documentation coverage audit |
| [Configuration & Environment](configuration.md) | Environment configuration guide |
| [API Usage Examples](api-reference.md) | API reference & examples |
| [Process Data Coldstorage Analysis](processDataColdstorage-function-analysis.md) | Cold storage data processing analysis |
| [Decision Records](decisions/README.md) | Architecture decision records |
| [Changelog](CHANGELOG.md) | Change log & version history |

---

> **Source:** [github.com/smile-health/backend](https://github.com/smile-health/backend)
> **Maintainer:** Platform Team
