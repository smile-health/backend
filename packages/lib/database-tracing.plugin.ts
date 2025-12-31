import {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  UnknownRow,
  CompiledQuery,
  Kysely,
} from "kysely";
import { SpanStatusCode, trace, Span, context } from "@opentelemetry/api";

// Extended interface to store query context with timing
interface QueryContext {
  node: RootOperationNode;
  queryId: string;
  compiledQuery?: CompiledQuery;
  startTime: number;
  span: Span;
  parentContext: ReturnType<typeof context.active>;
}

const KyselyOperationNodeToString = (
  node: RootOperationNode,
  compiledQuery?: CompiledQuery
): string => {
  try {
    // Try to get the compiled SQL if available
    if (compiledQuery?.sql) {
      // Return the actual SQL with parameter placeholders
      let sql = compiledQuery.sql;

      // Truncate very long queries for readability
      if (sql.length > 200) {
        sql = sql.substring(0, 200) + "...";
      }

      return `${sql} [${compiledQuery.parameters.length} params]`;
    }

    // Fallback: extract basic info from the node
    const nodeAny = node as Record<string, any>;

    // Try to get the table name if available
    let tableName = "unknown";
    if (nodeAny.from?.froms?.[0]?.table?.identifier?.name) {
      tableName = nodeAny.from.froms[0].table.identifier.name;
    } else if (nodeAny.into?.table?.identifier?.name) {
      tableName = nodeAny.into.table.identifier.name;
    } else if (nodeAny.table?.identifier?.name) {
      tableName = nodeAny.table.identifier.name;
    }

    // Get the operation kind
    const kind = nodeAny.kind || "UNKNOWN";

    // Return a simplified representation
    return `${kind} on ${tableName}`;
  } catch {
    // Fallback if the above fails
    return "Database Query";
  }
};

export class DatabaseTracingPlugin implements KyselyPlugin {
  private readonly tracer = trace.getTracer("kysely");
  private readonly queryContexts = new Map<string, QueryContext>();
  private db?: Kysely<Record<string, any>>;

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    let compiledQuery: CompiledQuery | undefined;

    try {
      // Try to compile the query to get the actual SQL
      if (this.db) {
        // Use the internal query executor to compile the query
        const executor = (this.db as Record<string, any>).getExecutor();
        if (executor && executor.compileQuery) {
          compiledQuery = executor.compileQuery(args.node, args.queryId);
        }
      }
    } catch {
      // If compilation fails, we'll proceed without the compiled query
    }

    // Generate a unique string identifier for the queryId object
    const queryIdString = this.generateQueryIdString(args.queryId);

    // Extract operation kind from the node
    const nodeAny = args.node as unknown as Record<string, unknown>;
    const operationKind = (nodeAny?.kind as string) || "UNKNOWN";

    const sqlStatement = KyselyOperationNodeToString(args.node, compiledQuery);

    // Start span BEFORE query execution to capture actual duration
    const parentCtx = context.active();
    const span = this.tracer.startSpan(
      `DB ${operationKind}`,
      {
        attributes: {
          "db.system": "mysql",
          "db.statement": sqlStatement,
          "db.operation": operationKind,
          "db.query_id": queryIdString,
          "db.parameter_count": compiledQuery?.parameters?.length || 0,
        },
      },
      parentCtx
    );

    // Log the query for development visibility
    if (process.env.APP_DEBUG === "true") {
      console.log(`🔍 [DB Query] ${operationKind}: ${sqlStatement}`);
    }

    // Store the query context with timing info
    this.queryContexts.set(queryIdString, {
      node: args.node,
      queryId: queryIdString,
      compiledQuery,
      startTime: Date.now(),
      span,
      parentContext: parentCtx,
    });

    return args.node;
  }

  async transformResult(
    args: PluginTransformResultArgs
  ): Promise<QueryResult<UnknownRow>> {
    const { result, queryId } = args;
    const queryIdString = this.generateQueryIdString(queryId);
    const queryContext = this.queryContexts.get(queryIdString);

    // Clean up the context map
    this.queryContexts.delete(queryIdString);

    if (!queryContext) {
      return result;
    }

    const { span, startTime, compiledQuery, node } = queryContext;
    const duration = Date.now() - startTime;

    // Extract operation kind from the node
    const nodeAny = node as unknown as Record<string, unknown>;
    const operationKind = (nodeAny?.kind as string) || "UNKNOWN";

    // Set duration attribute
    span.setAttribute("db.duration_ms", duration);

    // Check if there's an error in the result
    const hasError = result && "error" in result;

    if (hasError) {
      const error = (result as Record<string, unknown>).error as Error;
      span.recordException(error);
      span.addEvent("db.query.error", {
        "error.message": error.message,
        "error.name": error.name,
        "db.duration_ms": duration,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
      if (result && result.rows) {
        span.setAttribute("db.rows_affected", result.rows.length);
      }

      // Add success event with result information
      span.addEvent("db.query.success", {
        "db.rows_returned": result?.rows?.length || 0,
        "db.operation": operationKind,
        "db.duration_ms": duration,
      });
    }

    // End span AFTER query execution - this captures the real query time
    span.end();

    return result;
  }

  // Method to set the Kysely database instance
  setDatabase(db: Kysely<Record<string, any>>): void {
    this.db = db;
  }

  // Generate a unique string identifier from the queryId object
  private generateQueryIdString(queryId: unknown): string {
    try {
      // If queryId has a specific property we can use, use it
      if (queryId && typeof queryId === "object") {
        const queryIdObj = queryId as Record<string, unknown>;
        // Try common properties that might exist on the queryId object
        if ("queryId" in queryIdObj && queryIdObj.queryId) {
          return String(queryIdObj.queryId);
        }
        if ("id" in queryIdObj && queryIdObj.id) {
          return String(queryIdObj.id);
        }
        // Generate a hash-like string from the object
        const objStr = JSON.stringify(queryId);
        return `query_${this.simpleHash(objStr)}`;
      }
      // Fallback to string conversion
      return String(queryId);
    } catch {
      // Ultimate fallback - use timestamp + random
      return `query_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
  }

  // Simple hash function for generating consistent IDs
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}
