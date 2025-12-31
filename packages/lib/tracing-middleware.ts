import { Context, Next } from "hono";
import { trace, SpanStatusCode, Tracer } from "@opentelemetry/api";

export class TracingMiddleware {
  private readonly tracer: Tracer;

  constructor(tracerName: string = "hono-middleware") {
    this.tracer = trace.getTracer(tracerName);
  }

  public handle = (middlewareName: string) => {
    return async (c: Context, next: Next) => {
      return this.tracer.startActiveSpan(
        `middleware.${middlewareName}`,
        async (span) => {
          span.setAttributes({
            "middleware.name": middlewareName,
            "http.method": c.req.method,
            "http.route": c.req.path,
          });

          try {
            const start = Date.now();
            console.log(`Starting middleware: ${middlewareName}`);
            span.setAttribute("middleware.start_time", start);

            await next();
            const duration = Date.now() - start;
            span.setAttributes({
              "middleware.duration_ms": duration,
              "http.status_code": c.res.status,
            });
            span.setStatus({
              code:
                c.res.status >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
            });
          } catch (err: any) {
            span.recordException(err);
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: err.message,
            });
            throw err; // Re-throw the error so it can be handled by Hono's onError
          } finally {
            span.end();
          }
        }
      );
    };
  };
}
