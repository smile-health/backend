# SIHA/SITB Integration API – Technical Documentation (v1.0)

## SIHA/SITB System (Source)
- Role: Foundational source system and origin for all integration flows.
- Visual: SIHA/SITB System is depicted first in all diagrams as a distinct node.
- Purpose: Initiates requests to the Main API, drives confirmation/cancellation, and supplies data for catalog endpoints.
- Styling: Consistent highlight across docs and diagrams (amber fill, deeper stroke).

## SMILE System (Actor)
- Role: Validates and processes orders within the Main API, persists state, and communicates validation results back to SIHA/SITB before confirmation.
- Visual: Shown as the system owning `Main API`, `Persistence`, and status modules in architecture diagrams.
- Flow: Create at SIHA/SITB → SMILE validates → SIHA/SITB confirms (or cancels).

This document describes the SIHA/SITB integration endpoints provided by the Main API. It consolidates route definitions and schemas from `apps/main/src/openapi.ts` and `apps/main/src/modules/order-integration/siha/*`.

## Overview
- Base URL: `/api`
- API Style: REST, JSON
- OpenAPI 3.0 Spec: `adr/integration/siha-sitb-openapi.v1.yaml`
- Tag: `SIHA/SITB Integration`

## Authentication
- Scheme: Bearer JWT (`Authorization: Bearer <token>`)
- Applies to all endpoints except `POST /auth/login`.
- Note: Swagger UI (`/api` and `/api/doc`) can be protected with Basic Auth via environment variables `SWAGGER_USERNAME` and `SWAGGER_PASSWORD`.

## Error Model
- Common error response:
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid request body",
  "details": {"field": "order_items[0].kode_kfa"}
}
```
- Status Codes:
  - `200`: Success with body
  - `204`: Success without body
  - `401`: Unauthorized (missing/invalid token)
  - `403`: Forbidden (insufficient privileges)
  - `404`: Not Found (e.g., order missing)
  - `422`: Validation error

## Endpoints

### POST `/auth/login` (Public)
- Purpose: Authenticate user and return user info.
- Request:
```json
{ "username": "sitb_demo_v5", "password": "example" }
```
- Response (200):
```json
{ "id": 47732, "username": "user_name", "token_login": "<jwt>", "entity": {"id":1,"name":"Kemenkes RI"}, "updated_at": "2021-03-22T10:36:38.759Z" }
```

### POST `/v2/order/integration`
- Purpose: Create Order Integration.
- Auth: Bearer
- Request:
```json
{
  "type": 1,
  "customer_id": 1000720789,
  "vendor_id": 123456789,
  "activity_code": "tbso",
  "category": "ta_oat_so_pemesanan",
  "key_ssl": "TBSO_2019000005750026",
  "is_validate": 0,
  "total_patients": 10,
  "order_items": [{"external_order_item_id":"1","ordered_qty":10,"kode_kfa":"92004603"}]
}
```
- Response: `204 No Content`.

### PUT `/v2/order/{key_ssl}/confirm/integration`
- Purpose: Confirm Order Integration.
- Auth: Bearer
- Path Params: `key_ssl: string`
- Request:
```json
{
  "comment": "konfirmasi berdasarkan kasus",
  "activity_code": "tbso",
  "order_items": [{"confirmed_qty":10,"kode_kfa":"92004603"}]
}
```
- Response: `204 No Content`.

### PUT `/v2/order/{key_ssl}/cancel/integration`
- Purpose: Cancel Order Integration.
- Auth: Bearer
- Path Params: `key_ssl: string`
- Request:
```json
{ "cancel_reason": 1, "other_reason": "" }
```
- Response: `204 No Content`.

### GET `/v2/order/{key_ssl}/integration`
- Purpose: Get Order Integration details by external key.
- Auth: Bearer
- Path Params: `key_ssl: string`
- Response (200):
```json
{
  "id": 184873,
  "key_ssl": "TBSO_2019000005750013",
  "confirmed_at": "2025-07-17T03:50:58.000Z",
  "activity": {"id": 14, "name": "TB - Program"},
  "customer": {"id": 824780, "name": "DINKES PROV. JAWA BARAT"},
  "vendor": {"id": 824707, "name": "Kemenkes RI"},
  "order_items": [{"id":289616,"code_kfa_product_template":"92004603","qty":10,"confirmed_qty":10}]
}
```

### GET `/v2/order/{order_id}`
- Purpose: Get Order details by SMILE order ID.
- Auth: Bearer
- Path Params: `order_id: number`
- Response: Same structure as `/v2/order/{key_ssl}/integration`.

### GET `/v2/orders`
- Purpose: Paginated list of orders with filters.
- Auth: Bearer
- Query (selected): `activity_id, page, paginate, from_date, to_date, status, type, entity_id, entity_province_id, entity_city_id, entity_puskesmas_id`
- Response (200):
```json
{
  "total": 22605,
  "page": "1",
  "perPage": "10",
  "list": [{
    "id": 208703,
    "status": 5,
    "type": 2,
    "customer": {"id": 22556, "name": "PUSKESMAS PLAYEN  I"},
    "vendor": {"id": 18308, "name": "DINKES KAB. GUNUNG KIDUL"},
    "activity": {"id": 1, "name": "Malaria - Rutin"}
  }]
}
```

### GET `/v2/materials`
- Purpose: Paginated list of materials.
- Auth: Bearer
- Query: `page, paginate`
- Response (200):
```json
{
  "total": 82,
  "page": "1",
  "perPage": "1",
  "list": [{"id":56,"name":"ADS 0.05 ml Kampanye (buah)","unit":"buah","is_vaccine":1,"material_tags":[{"id":1,"title":"Imunisasi Rutin"}]}]
}
```

### GET `/entities`
- Purpose: Paginated list of entities.
- Auth: Bearer
- Query (selected): `type, province_id, regency_id, sub_disctrict_id, village_id, is_vendor, page, paginate, updated_at_from, updated_at_to, entity_tag, keyword`
- Response (200):
```json
{
  "total": 101,
  "page": "1",
  "perPage": "1",
  "list": [{"id":21208,"name":"PUSKESMAS CISARUA","type":3,"province":{"id":"32","name":"PROV. JAWA BARAT"}}]
}
```

### GET `/manufactures`
- Purpose: Paginated list of manufactures.
- Auth: Bearer
- Query: `page, paginate`
- Response (200):
```json
{
  "total": 346,
  "page": 1,
  "perPage": 10,
  "list": [{"id":1,"name":"Biofarma","status":1}]
}
```

### GET `/budget-sources`
- Purpose: Paginated list of budget sources.
- Auth: Bearer
- Query: `page, paginate`
- Response (200):
```json
{ "total": 5, "page": 1, "perPage": 10, "list": [{"id":1,"name":"APBN"}] }
```

## Diagrams
- Sequence: `adr/diagrams/SIHA_SITB_sequence_v1.mmd`
- Architecture: `adr/diagrams/SIHA_SITB_architecture_v1.mmd`

## Notes
- External SIHA calls use Basic Auth and SSL settings via `SihaGateway`; this is internal to the service and not a public API security scheme.
- Request/response schemas are derived from `@hono/zod-openapi` definitions in `siha.routes.ts` and `siha.schemas.ts`.