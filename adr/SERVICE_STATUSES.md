# Service Status Dashboard

## Staging Environment 🚀

## Backend Services

| Service          | Environment | Status     |
| ---------------- | ----------- | ---------- |
| Backend Service  | 🚀 staging  | ✅ running |
| Frontend Service | 🚀 staging  | ✅ running |

## Infrastructure Services

| Service       | Environment | Status     |
| ------------- | ----------- | ---------- |
| MySQL         | 🚀 staging  | ✅ running |
| Clickhouse    | 🚀 staging  | ✅ running |
| Redis         | 🚀 staging  | ✅ running |
| RabbitMQ      | 🚀 staging  | ✅ running |
| MinIO Storage | 🚀 staging  | ✅ running |
| Keycloak      | 🚀 staging  | ✅ running |
| Translation   | 🚀 staging  | ✅ running |

## Dev Environment 🛠️

## Backend Services

| Service          | Environment | Status     |
| ---------------- | ----------- | ---------- |
| Backend Service  | 🛠️ dev      | ✅ running |
| Frontend Service | 🛠️ dev      | ✅ running |

## Infrastructure Services

| Service       | Environment | Status     |
| ------------- | ----------- | ---------- |
| MySQL         | 🛠️ dev      | ✅ running |
| Clickhouse    | 🛠️ dev      | ✅ running |
| Redis         | 🛠️ dev      | ✅ running |
| RabbitMQ      | 🛠️ dev      | ✅ running |
| MinIO Storage | 🛠️ dev      | ✅ running |
| Keycloak      | 🛠️ dev      | ✅ running |
| Translation   | 🛠️ dev      | ✅ running |

## Service Ports

| Service            | Port | Container             |
| ------------------ | ---- | --------------------- |
| Core Service       | 3000 | service-core          |
| Immunization       | 3001 | service-immunization  |
| Medicine           | 3002 | service-medicine      |
| Auth Service       | 3003 | service-auth          |
| Main Service       | 3004 | service-main          |
| Warehouse Service  | 3006 | service-warehouse     |
| Main API v3.0      | 3007 | service-main-api      |
| Warehouse API v3.0 | 3009 | service-warehouse-api |
| Nginx Proxy        | 80   | proxy                 |

---

**Last updated:** $(date)

---

Environment Icons:

- 🌟 production = Live production environment
- 🚀 staging = Production-ready staging environment
- 🛠️ dev = Development environment
  Status Icons:

- ✅ running = Service is running and healthy
- ❌ failed = Service is down or experiencing issues
- ⚠️ warning = Service is running but with warnings
- 🔄 pending = Service is starting up or being deployed
- 🔄 updated = Service has been updated with new code
- 🚀 deployed = Service has been successfully deployed
- 🔧 maintenance = Service is under maintenance
- 📊 monitoring = Service is being monitored
- 🔒 secured = Service security checks passed
