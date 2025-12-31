# `@smile/lib` Package Documentation

This document provides an overview and usage guidelines for the `@smile/lib` shared package, which centralizes common functionalities across the SMILE platform.

---

## Module: `database.ts`

- **Purpose**: Provides classes for managing database connections and transactions using `Kysely`, a type-safe SQL query builder.
- **Key Classes**:
  - `TransactionManager<DB>`: Manages database transactions.
  - `DatabaseManager<DB>`: Initializes and provides a Kysely database instance.
- **Dependencies**: `kysely`
- **Usage**:

  ```typescript
  import { DatabaseManager, TransactionManager } from "@smile/lib/database";
  import { Dialect } from "kysely"; // Example dialect, replace with your specific dialect

  // Example: MyDatabaseSchema would be your Kysely database schema type
  interface MyDatabaseSchema {
    users: {
      id: number;
      name: string;
    };
    // ... other tables
  }

  // Initialize DatabaseManager
  // 'dialect' should be an instance of your database dialect (e.g., new PostgresDialect())
  // 'debug' (boolean) controls whether Kysely logs queries and errors
  const dialect: Dialect = {
    /* your dialect configuration */
  };
  const dbManager = new DatabaseManager<MyDatabaseSchema>(dialect, true);
  const db = dbManager.getDB();

  // Use TransactionManager to run operations within a transaction
  const trxManager = new TransactionManager<MyDatabaseSchema>(db);

  async function performTransactionalOperation() {
    try {
      const result = await trxManager.transaction(async (trx) => {
        // Perform database operations within this transaction
        // For example:
        await trx.insertInto("users").values({ name: "John Doe" }).execute();
        const users = await trx.selectFrom("users").selectAll().execute();
        return users;
      });
      console.log("Transaction completed successfully. Result:", result);
    } catch (error) {
      console.error("Transaction failed:", error);
    }
  }

  // Example of using DatabaseManager directly (without a transaction)
  async function fetchUsers() {
    const allUsers = await dbManager
      .getDB()
      .selectFrom("users")
      .selectAll()
      .execute();
    console.log("All users:", allUsers);
  }

  // Call example functions (for demonstration)
  // performTransactionalOperation();
  // fetchUsers();
  ```

---

## Module: `error-excel.ts`

- **Purpose**: Defines custom error classes specifically for Excel-related operations, extending a base `ExcelError` class.
- **Key Classes**:
  - `ExcelError`: Base class for all Excel-related errors.
  - `SheetNotFound`: Error for when a specified sheet is not found.
  - `WorkbookNotFound`: Error for when a workbook file is not found.
  - `WorkbookEmpty`: Error for an empty workbook.
- **Dependencies**: None (internal dependencies)
- **Usage**:

  ```typescript
  import {
    SheetNotFound,
    WorkbookNotFound,
    WorkbookEmpty,
  } from "@smile/lib/error-excel";

  function processExcelFile(filename: string, sheetName: string, data: any[]) {
    if (!filename) {
      throw new WorkbookNotFound("excel.not_workbook"); // Custom message or default
    }
    if (data.length === 0) {
      throw new WorkbookEmpty("excel.empty_workbook");
    }
    if (sheetName !== "ExpectedSheet") {
      throw new SheetNotFound("The sheet 'ExpectedSheet' was not found.");
    }
    console.log("Excel file processed successfully.");
  }

  try {
    // Simulate an error
    processExcelFile("my_data.xlsx", "WrongSheet", [{ a: 1 }]);
  } catch (error) {
    if (error instanceof SheetNotFound) {
      console.error(
        `Error: Sheet Not Found [${error.statusCode}]: ${error.message}`
      );
    } else if (error instanceof WorkbookEmpty) {
      console.error(
        `Error: Workbook Empty [${error.statusCode}]: ${error.message}`
      );
    } else if (error instanceof WorkbookNotFound) {
      console.error(
        `Error: Workbook Not Found [${error.statusCode}]: ${error.message}`
      );
    } else {
      console.error("An unknown error occurred:", error);
    }
  }

  // Example with default messages
  try {
    throw new WorkbookEmpty(); // Uses default message "excel.empty_workbook"
  } catch (error) {
    if (error instanceof WorkbookEmpty) {
      console.error(`Error: ${error.message}`);
    }
  }
  ```

---

## Module: `error.ts`

- **Purpose**: Defines common HTTP error classes, extending a base `HTTPError` class, useful for API responses.
- **Key Classes**:
  - `HTTPError`: Base class for all HTTP-related errors, with a `statusCode`.
  - `BadRequestError` (400)
  - `UnauthorizedError` (401)
  - `ForbiddenError` (403)
  - `NotFoundError` (404)
  - `ValidationError` (422)
- **Dependencies**: None (internal dependencies)
- **Usage**:

  ```typescript
  import {
    BadRequestError,
    UnauthorizedError,
    NotFoundError,
    HTTPError,
  } from "@smile/lib/error";

  function handleApiRequest(
    userId: string,
    resourceId: string,
    isAdmin: boolean
  ) {
    if (!userId || !resourceId) {
      throw new BadRequestError("Missing required parameters.");
    }
    if (userId === "guest") {
      throw new UnauthorizedError("Authentication required.");
    }
    if (resourceId === "admin-only" && !isAdmin) {
      // Example of using a specific HTTP error for forbidden access
      throw new UnauthorizedError("Access to this resource is forbidden."); // Using Unauthorized for simplicity, but could be ForbiddenError
    }
    if (resourceId === "non-existent") {
      throw new NotFoundError("The requested resource does not exist.");
    }
    console.log("Request handled successfully.");
  }

  try {
    handleApiRequest("some-user-id", "non-existent", false);
  } catch (error) {
    if (error instanceof HTTPError) {
      console.error(`API Error [${error.statusCode}]: ${error.message}`);
      // In a real application, you might send this error back as an HTTP response
      // res.status(error.statusCode).json({ message: error.message });
    } else {
      console.error("An unexpected error occurred:", error);
    }
  }

  // Example with default messages
  try {
    throw new BadRequestError(); // Uses default message "Bad Request"
  } catch (error) {
    if (error instanceof BadRequestError) {
      console.error(`Default Bad Request: ${error.message}`);
    }
  }
  ```

---

## Module: `excel.ts`

- **Purpose**: Provides classes for generating and parsing Excel files using `exceljs`.
- **Key Classes**:
  - `ExportTemplate`: For creating and populating Excel files.
  - `ImportTemplate`: For reading data from Excel files.
- **Dependencies**: `exceljs`
- **Usage (ExportTemplate)**:

  ```typescript
  import { ExportTemplate } from "@smile/lib/excel";
  import * as fs from "fs"; // Node.js File System module for saving the buffer

  async function exportSampleData() {
    const exporter = new ExportTemplate("Products"); // Name of the model/sheet
    exporter.setColumns([
      { header: "Product ID", key: "id", width: 15 },
      { header: "Product Name", key: "name", width: 30 },
      {
        header: "Price",
        key: "price",
        width: 10,
        style: { numFmt: '"$"#,##0.00' },
      },
    ]);

    exporter.addRow({ id: 101, name: "Laptop", price: 1200.5 });
    exporter.addRow({ id: 102, name: "Mouse", price: 25.0 });
    exporter.addRow({ id: 103, name: "Keyboard", price: 75.99 });

    // Example of setting a cell value and styling
    exporter.setCell({
      cell: "A1",
      value: "Product Sales Report",
      width: 40,
      bold: true,
    });
    exporter.mergeCells("A1", "C1"); // Merge cells from A1 to C1

    // Example of creating a table
    exporter.createTable({
      tableName: "SalesData",
      startCell: "A5", // Start table from cell A5
      theme: "TableStyleLight9", // Optional: Excel table style
      columns: [
        { header: "Region", width: 15 },
        { header: "Sales Q1", width: 15 },
        { header: "Sales Q2", width: 15 },
      ],
      rows: [
        ["North", 1000, 1200],
        ["South", 800, 950],
      ],
    });

    // Example of setting custom cell styles for a range
    exporter.setCustomCells({
      startCell: "A10",
      totalRowData: 2,
      totalColumnData: 2,
      options: {
        border: {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFCCEEFF" },
        },
        alignment: { vertical: "middle", horizontal: "center" },
        font: { name: "Arial", size: 12, color: { argb: "FF000000" } },
      },
    });

    const fileResponse = await exporter.generate("product_report.xlsx");
    // fileResponse.buffer is a Node.js Buffer containing the Excel file
    fs.writeFileSync("product_report.xlsx", fileResponse.buffer);
    console.log("product_report.xlsx generated.");
  }

  // exportSampleData();
  ```

- **Usage (ImportTemplate)**:

  ```typescript
  import { ImportTemplate } from "@smile/lib/excel";
  import * as fs from "fs";

  async function importSampleData(filePath: string) {
    try {
      const buffer = fs.readFileSync(filePath);
      // columnSize: expected number of columns
      // startRow: row number from which to start reading data (e.g., 14 typically for data after headers)
      // startSheet: sheet index to start reading from (default is 1)
      const importer = new ImportTemplate(3, 2, 0); // Assuming 3 columns, starting read from row 2 (index 1), sheet 0 (first sheet)
      await importer.loadFromBuffer(buffer);

      const columns = importer.getColumns(); // Returns an array of column headers (strings)
      const rows = importer.getRows(); // Returns a 2D array of data rows (string[][])

      console.log("Imported Columns:", columns);
      console.log("Imported Rows:", rows);
    } catch (error) {
      console.error("Error importing Excel file:", error);
    }
  }

  // To test import: first ensure 'product_report.xlsx' exists from the export example,
  // or provide a path to an existing Excel file.
  // importSampleData("product_report.xlsx");
  ```

---

## Module: `i18n.ts`

- **Purpose**: Configures and initializes the `i18next` internationalization library, dynamically loading translation resources from a Tolgee API.
- **Key Export**: `i18n` - The initialized `i18next` instance.
- **Dependencies**: `i18next`, `i18next-fs-backend`, `path`, `url`, `node-fetch` (implicitly, as `fetch` is used).
- **Configuration**:
  - `TOLGEE_URL`, `TOLGEE_PROJECT_ID`, `TOLGEE_API_KEY`: Environment variables used to fetch translations from the Tolgee platform.
  - `fallbackLng`: "en" - Default fallback language.
  - `loadPath`: `./lang/{lng}.json` - Fallback path for local translation files if Tolgee API is unreachable.
- **Usage**:

  ```typescript
  // In your application, import the i18n instance.
  // Ensure that environment variables (TOLGEE_URL, TOLGEE_PROJECT_ID, TOLGEE_API_KEY)
  // are set if you intend to load translations from Tolgee.
  import i18n from "@smile/lib/i18n"; // Note: might need .js extension for direct ESM import

  async function demonstrateTranslations() {
    // The i18n instance is already initialized when imported due to top-level await.
    // Use i18n.t() for translation.
    console.log(i18n.t("hello", "Hello, default!"));
    console.log(i18n.t("validator.string", { field: "email" }));
    console.log(i18n.t("auth.invalid", "Invalid credentials.")); // Example using a common auth key
    console.log(i18n.t("common.welcome_message", { name: "User" })); // Example with interpolation

    // You can also change the language if needed (though usually set once per request/session)
    // await i18n.changeLanguage("id");
    // console.log(i18n.t("hello", "Halo, default!"));
  }

  // Call the function to see output
  // demonstrateTranslations();
  ```

- **Important**: The `i18n` instance is initialized using a top-level `await loadResources()`. This means that any module importing `i18n.ts` must also be an ES module and either be part of a `top-level await` context or handle its asynchronous nature.

---

## Module: `logger.ts`

- **Purpose**: Implements a robust logging mechanism using `pino` for structured logging, with support for sending logs to Loki and middleware for HTTP request logging in Hono applications.
- **Key Exports**:
  - `logger`: A `pino` logger instance for general application logging.
  - `httpLogger`: A Hono middleware for comprehensive logging of HTTP requests and responses.
- **Dependencies**: `pino`, `pino-loki`, `hono`, `@hono/factory`.
- **Configuration**:
  - Logs can be sent to Loki if `process.env.LOKI_SEND` is "true" and `process.env.LOKI_HOST` is defined.
  - `LOKI_INTERVAL`, `LOKI_TIMEOUT`: Batching and timeout for Loki export.
  - `APP_ROOT_NAME`, `APP_NAME`: Labels for Loki logs.
  - `LOKI_USERNAME`, `LOKI_PASSWORD`: Basic authentication for Loki.
  - Logs are also written to standard output (STDOUT).
- **Usage (General Logging)**:

  ```typescript
  import { logger } from "@smile/lib/logger";

  logger.info("Application started.");
  logger.debug({ config: { logLevel: "info" } }, "Configuration loaded.");
  logger.warn("Potential issue: low disk space.");
  logger.error(
    { errorCode: 500, detail: "Database connection failed" },
    "Critical error occurred."
  );
  ```

- **Usage (HTTP Logging with Hono)**:

  ```typescript
  import { Hono } from "hono";
  import { httpLogger } from "@smile/lib/logger";

  const app = new Hono();

  // Apply the HTTP logger middleware at the beginning of your request pipeline
  app.use(httpLogger);

  app.get("/", (c) => c.text("Hello from Hono!"));
  app.post("/users", async (c) => {
    const body = await c.req.json();
    logger.info({ body }, "Received new user data.");
    return c.json({ message: "User created." }, 201);
  });

  // To run this Hono app, you would typically use a server like Bun or Node.js.
  // For example, with Bun:
  // Bun.serve({
  //   fetch: app.fetch,
  //   port: 3000,
  // });
  // console.log("Hono app running on http://localhost:3000");
  ```

---

## Module: `tracing.ts`

- **Purpose**: Initializes and configures OpenTelemetry for distributed tracing and metrics collection across the application. This helps in monitoring and debugging microservices by providing end-to-end visibility of requests.
- **Key Functionality**:
  - Sets up the OpenTelemetry Node.js SDK.
  - Automatically instruments common libraries (e.g., HTTP, Node.js internals) using `getNodeAutoInstrumentations`.
  - Configures `OTLPTraceExporter` and `OTLPMetricExporter` to send traces and metrics to an OTLP-compatible endpoint (e.g., Jaeger, Prometheus, Tempo).
- **Dependencies**:
  - `@opentelemetry/sdk-node`
  - `@opentelemetry/auto-instrumentations-node`
  - `@opentelemetry/exporter-trace-otlp-grpc`
  - `@opentelemetry/exporter-metrics-otlp-grpc`
  - `@opentelemetry/sdk-metrics`
  - `@opentelemetry/resources`
  - `@opentelemetry/instrumentation-http`
  - `@opentelemetry/semantic-conventions`
- **Configuration**:
  - `OTLP_ENDPOINT`: Environment variable to specify the OpenTelemetry collector endpoint (default: `http://localhost:4318`).
  - `APP_NAME`: Service name for traces/metrics (default: `smile5`).
  - `APP_SERVICE_VERSION`: Service version (default: `1.0`).
- **Usage**:

  This module is designed to be imported once at the very beginning of your application's entry point. Simply importing it will start the OpenTelemetry SDK and enable tracing/metrics.

  ```typescript
  // In your main application file (e.g., src/index.ts, main.ts, or app.ts),
  // ensure this import is one of the first lines to properly capture everything.
  import "@smile/lib/tracing";

  // Your main application logic follows here.
  // For example, if you have a Hono app:
  // import { Hono } from 'hono';
  // const app = new Hono();
  // app.get('/hello', (c) => c.text('Hello Trace!'));
  // Bun.serve({ fetch: app.fetch });

  // OpenTelemetry will now automatically capture traces and metrics
  // for HTTP requests, database calls (if instrumented), etc.
  // You can also manually create spans for custom operations:
  /*
  import { trace } from '@opentelemetry/api';
  
  const tracer = trace.getTracer('my-application-tracer');
  
  async function myTracedFunction() {
    const span = tracer.startSpan('myTracedFunction');
    try {
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      span.setAttribute('operation.result', 'success');
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
    } finally {
      span.end();
    }
  }
  
  // myTracedFunction();
  */
  ```

- **Important**: Ensure `OTLP_ENDPOINT` points to your OpenTelemetry collector or observability backend.

---

## Module: `utils.ts`

- **Purpose**: A comprehensive collection of general-purpose utility functions for common data manipulation tasks, including array transformations, object handling, string validations, date comparisons, and type conversions.
- **Key Functions**:
  - `group<T, K>(rows: T[], field: K)`: Groups an array of objects by a specified field.
  - `associate<T, K>(rows: T[], field: K)`: Creates an object mapping a field's value to the entire row.
  - `associateField<T, K, V>(rows: T[], field: K, valueField: V)`: Creates an object mapping a field's value to another specified field's value.
  - `collect<T, K>(rows: T[], ...fields: K[])`: Extracts unique non-null values from specified fields across an array of objects.
  - `merge<T>(...arrays: T[][])`: Merges multiple arrays and returns unique values.
  - `pick<T, K>(row: T, columns: K[])`: Creates a new object with only the specified columns from an existing object.
  - `differ<T>(array1: T[], array2: T[])`: Returns elements present in `array1` but not in `array2`.
  - `consist<T>(array1: T[], array2: T[])`: Returns elements common to both `array1` and `array2`.
  - `isStringNumbers(stringOfNumbers: string)`: Validates if a string contains comma-separated numbers.
  - `transformStringNumbersToArrayNumbers(stringOfNumbers: string)`: Converts a comma/space/semicolon/pipe-separated string of numbers to an array of numbers.
  - `transformStringNumbersToArrayStringNumbers(stringOfNumbers: string)`: Converts a string of numbers to an array of string numbers.
  - `hasWhiteSpace(str: string)`: Checks if a string has leading/trailing whitespace (returns true if `str` is equal to `str.trim()`, which means no whitespace). **Note**: This function's name and behavior might be counter-intuitive; it returns `true` if _no_ leading/trailing whitespace is found.
  - `getLabelByKey<T, V>(obj: T, value: V)`: Finds the key in an object that corresponds to a given value and formats it.
  - `containsOnlyUnderscoresPeriod(str: string)`: Checks if a string contains only alphanumeric characters, underscores, and periods.
  - `isDateMoreThanNow(date: Date)`: Checks if a given date is after the current date (YYYY-MM-DD comparison).
  - `convertToBoolean(input: string | number | null | undefined)`: Converts various inputs to a boolean.
  - `getDefaultNumber(value: number | string | undefined | null)`: Returns a number or 0 if the input is invalid.
  - `flattenToNestedObject<T extends Row>(dataArray: T[])`: Transforms an array of flat objects with dot-notation keys into an array of nested objects.
  - `getUniqueIdsFromFields<T, K>(items: T[], ...fields: K[])`: Extracts unique non-null/undefined numeric IDs from specified fields across an array of objects.
  - `formatPeriodName(month: number | null, year: number | null, language?: string)`: Formats a month and year into a localized period name (e.g., "May 2023").
- **Dependencies**: `moment`
- **Usage (Examples)**:

  ```typescript
  import {
    group,
    associate,
    collect,
    merge,
    pick,
    isStringNumbers,
    transformStringNumbersToArrayNumbers,
    convertToBoolean,
    flattenToNestedObject,
    getUniqueIdsFromFields,
    formatPeriodName,
  } from "@smile/lib/utils";

  // Example data
  const employees = [
    { id: 1, name: "Alice", department: "HR", salary: 50000, managerId: null },
    { id: 2, name: "Bob", department: "IT", salary: 60000, managerId: 1 },
    { id: 3, name: "Charlie", department: "HR", salary: 55000, managerId: 1 },
  ];

  console.log("--- group ---");
  const employeesByDept = group(employees, "department");
  // { "HR": [{...}, {...}], "IT": [{...}] }
  console.log(JSON.stringify(employeesByDept, null, 2));

  console.log("\n--- associate ---");
  const employeesById = associate(employees, "id");
  // { "1": {...}, "2": {...}, "3": {...} }
  console.log(JSON.stringify(employeesById, null, 2));

  console.log("\n--- collect ---");
  const uniqueDepartments = collect(employees, "department");
  // [ "HR", "IT" ]
  console.log(uniqueDepartments);
  const uniqueManagerIds = collect(employees, "managerId");
  // [ 1 ]
  console.log(uniqueManagerIds);

  console.log("\n--- merge ---");
  const arr1 = [1, 2, 3];
  const arr2 = [3, 4, 5];
  const mergedUnique = merge(arr1, arr2); // [1, 2, 3, 4, 5]
  console.log(mergedUnique);

  console.log("\n--- pick ---");
  const aliceInfo = pick(employees[0], ["id", "name"]);
  // { id: 1, name: "Alice" }
  console.log(aliceInfo);

  console.log(
    "\n--- isStringNumbers & transformStringNumbersToArrayNumbers ---"
  );
  const idString = "1, 5, 10";
  console.log(isStringNumbers(idString)); // true
  console.log(transformStringNumbersToArrayNumbers(idString)); // [1, 5, 10]

  console.log("\n--- convertToBoolean ---");
  console.log(convertToBoolean("true")); // true
  console.log(convertToBoolean(1)); // true
  console.log(convertToBoolean("false")); // false
  console.log(convertToBoolean(0)); // false
  console.log(convertToBoolean(null)); // false

  console.log("\n--- flattenToNestedObject ---");
  const flatData = [
    {
      "user.name": "Alice",
      "user.email": "alice@example.com",
      "address.city": "NY",
    },
    {
      "user.name": "Bob",
      "user.email": "bob@example.com",
      "address.city": "LA",
    },
  ];
  const nestedData = flattenToNestedObject(flatData);
  console.log(JSON.stringify(nestedData, null, 2));
  /*
  [
    { "user": { "name": "Alice", "email": "alice@example.com" }, "address": { "city": "NY" } },
    { "user": { "name": "Bob", "email": "bob@example.com" }, "address": { "city": "LA" } }
  ]
  */

  console.log("\n--- getUniqueIdsFromFields ---");
  const itemsWithIds = [
    { id: 1, userId: 10, categoryId: 100 },
    { id: 2, userId: 20, categoryId: null },
    { id: 3, userId: 10, categoryId: 200 },
    { id: 4, userId: undefined, categoryId: 100 },
  ];
  const uniqueUserAndCategoryIds = getUniqueIdsFromFields(
    itemsWithIds,
    "userId",
    "categoryId"
  );
  console.log(uniqueUserAndCategoryIds); // [10, 20, 100, 200]

  console.log("\n--- formatPeriodName ---");
  console.log(formatPeriodName(3, 2024, "en")); // March 2024
  console.log(formatPeriodName(3, 2024, "id")); // Maret 2024
  console.log(formatPeriodName(null, 2024, "en")); // null
  ```

---

## Module: `zod.ts`

- **Purpose**: Provides utility functions for formatting and translating validation errors generated by `Zod`, a TypeScript-first schema declaration and validation library. It integrates with `i18next` for multilingual error messages.
- **Key Functions**:
  - `formatErrors(error: ZodError, t: TFunction, module?: string)`: Transforms a `ZodError` into a structured object, translating error messages based on `i18next` and an optional module context.
  - `formatExcelErrors(error: ZodError, startRow: number, t: TFunction)`: Specifically formats `ZodError` for Excel import scenarios, indicating errors by row number and column name.
  - `translateError(error: ZodIssue, t: TFunction, module?: string)`: Translates a single `ZodIssue` into a human-readable string using `i18next`.
  - `conditionsMessage(c: z.RefinementCtx, message: string, conds: boolean, path?: (string | number)[])`: A helper for `Zod` `superRefine` to add custom validation issues.
- **Dependencies**: `zod`, `i18next`.
- **Usage (General Zod Error Formatting)**:

  ```typescript
  import { z, ZodError } from "zod";
  import { formatErrors } from "@smile/lib/zod";
  import i18n from "@smile/lib/i18n"; // Assuming i18n is initialized as shown in i18n.ts documentation

  // Initialize i18n for demonstration if not already
  // For a real app, this would be handled by your app's startup.
  // await i18n.init(); // Only if not already initialized via top-level await

  const UserSchema = z.object({
    username: z.string().min(3, "validator.min_length^Username"), // message format: key^field_name
    email: z.string().email("validator.email^Email"),
    age: z.number().int().positive("validator.positive^Age"),
    address: z.object({
      street: z.string().min(5, "validator.min_length^Street"),
      zip: z.string().regex(/^\d{5}$/, "validator.zip_format^ZIP Code"),
    }),
  });

  try {
    UserSchema.parse({
      username: "jo", // Too short
      email: "invalid-email", // Invalid format
      age: 0, // Not positive
      address: {
        street: "abc", // Too short
        zip: "123", // Invalid format
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      // 'common' is an example module.translations might be under 'common.label.Username'
      const formatted = formatErrors(error, i18n.t, "common");
      console.log("Formatted Errors:", JSON.stringify(formatted, null, 2));
      /* Example output (assuming translations exist):
      {
        "username": [ "Username must be at least 3 characters long." ],
        "email": [ "Email is invalid." ],
        "age": [ "Age must be a positive number." ],
        "address": {
          "street": [ "Street must be at least 5 characters long." ],
          "zip": [ "ZIP Code is invalid format." ]
        }
      }
      */
    }
  }
  ```

- **Usage (Excel Error Formatting)**:

  ```typescript
  import { z, ZodError } from "zod";
  import { formatExcelErrors } from "@smile/lib/zod";
  import i18n from "@smile/lib/i18n"; // Assuming i18n is initialized

  const ExcelRowSchema = z.object({
    productName: z.string().min(1, "validator.not_empty^Product Name"),
    quantity: z.number().int().min(1, "validator.min_value^Quantity"),
    price: z.number().positive("validator.positive^Price"),
  });

  const ExcelImportSchema = z.array(ExcelRowSchema);

  const sampleExcelData = [
    { productName: "Item A", quantity: 5, price: 10.5 },
    { productName: "", quantity: 0, price: -5.0 }, // Error on row 1 (index 1)
    { productName: "Item C", quantity: 1, price: 20.0 },
    { productName: "Item D", quantity: 1.5, price: 15.0 }, // Error on row 3 (index 3)
  ];

  const startExcelRow = 2; // Assuming data starts from row 2 in Excel (human-readable)

  try {
    ExcelImportSchema.parse(sampleExcelData);
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedExcelErrors = formatExcelErrors(
        error,
        startExcelRow,
        i18n.t
      );
      console.log(
        "Formatted Excel Errors:",
        JSON.stringify(formattedExcelErrors, null, 2)
      );
      /* Example output (assuming translations exist):
      {
        "3": [ // Row 3 in Excel (index 1 + startExcelRow)
          "Product Name cannot be empty.",
          "Quantity must be at least 1.",
          "Price must be a positive number."
        ],
        "5": [ // Row 5 in Excel (index 3 + startExcelRow)
          "Quantity must be an integer."
        ]
      }
      */
    }
  }
  ```

- **Usage (Custom Conditions with `conditionsMessage`)**:

  ```typescript
  import { z } from "zod";
  import { conditionsMessage } from "@smile/lib/zod";

  const PasswordPolicySchema = z.string().superRefine((val, ctx) => {
    conditionsMessage(
      ctx,
      "Password must be at least 8 characters long.",
      val.length < 8,
      ["length_error"]
    );
    conditionsMessage(ctx, "Password must contain a number.", !/\d/.test(val), [
      "numeric_error",
    ]);
    conditionsMessage(
      ctx,
      "Password must contain an uppercase letter.",
      !/[A-Z]/.test(val)
    );
  });

  try {
    PasswordPolicySchema.parse("shortp1"); // Fails length, no uppercase
  } catch (error) {
    if (error instanceof ZodError) {
      console.log(
        "Password Policy Errors:",
        JSON.stringify(error.errors, null, 2)
      );
      /* Example output:
      [
        {
          "code": "custom",
          "message": "Password must be at least 8 characters long.",
          "path": [ "length_error" ]
        },
        {
          "code": "custom",
          "message": "Password must contain an uppercase letter.",
          "path": []
        }
      ]
      */
    }
  }
  ```
