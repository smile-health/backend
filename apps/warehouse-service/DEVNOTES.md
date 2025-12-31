# Warehouse Service - Developer's Note

Our attempt to standarize the repository.

### 14 August 2025

- Do not forget to include `master_deleted_at is null` condition on every datamart query
- To generate paginated or export master list, please use the already created utility modules such as activity, entity, material, location, etc.

### 01 July 2025

- For query params type, please use `QueryParamsSchema` instead of `QueryParamSchema` in `./src/common/schemas/query-param.schema.ts`.
- There are two method to export excel in warehouse-service, synchronous and asynchronous, explained below.
- For synchronous operation, we use `WarehouseTemplate` from shared package, please refer to `./src/modules/stock-opname/stock-opname.module.ts` or `./src/modules/reconciliation/reconciliation.module.ts`, all export functions use this utility class.
- For asynchronous operation, the same template is used, but through another utility class called `MultiSheetZipExporter` from shared package. Refer to `./src/modules/stock-book/stock-book.module.ts`, here we use the exporter utility class to generate excel in the background and send it to the export-async service in the main app.

### 31 May 2025

- It is **strongly** recommended not to use user-activity, monitoring-stock, and monitoring-transaction modules as a base of reference for implementing another feature module.
- Most of their code are hard to read, and not standarized enough.
