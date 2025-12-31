import { pino } from "pino";
import { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { LokiOptions } from "pino-loki";

const sendLoki = {
  target: "pino-loki",
  options: {
    batching: true,
    interval: process.env.LOKI_INTERVAL ?? 5,
    timeout: process.env.LOKI_TIMEOUT ?? 5e3,
    labels: {
      application: process.env.APP_ROOT_NAME ?? "smile5",
      service_name: process.env.APP_NAME ?? "smile5",
    },
    host: process.env.LOKI_HOST ?? "http://127.0.0.1:3100",
    basicAuth: {
      username: process.env.LOKI_USERNAME ?? "",
      password: process.env.LOKI_PASSWORD ?? "",
    },
  },
};
const shouldUseLoki =
  process.env.LOKI_SEND == "true" && process.env.LOKI_HOST ? true : false;

const transport = pino.transport<LokiOptions>({
  targets: [
    ...(shouldUseLoki ? [sendLoki] : []),
    {
      target: "pino/file",
      options: { destination: 1 }, // this writes to STDOUT
    },
  ],
});

export const logger = pino(transport);

const serializers = {
  req: (c: Context) => ({
    id: c.get("requestId"),
    method: c.req.method,
    url: c.req.url,
    query: c.req.query(),
    headers: c.req.header(),
  }),
  res: (c: Context) => ({
    statusCode: c.res.status,
    error: {
      message: c.error?.message,
      stack: c.error?.stack,
    },
  }),
};

export const httpLogger = createMiddleware(async (c, next) => {
  logger.info({
    req: serializers.req(c),
    msg: "request received",
  });

  const startTime = Date.now();
  await next();
  const responseTime = Date.now() - startTime;

  logger.info({
    req: serializers.req(c),
    res: serializers.res(c),
    responseTime,
    msg: "request completed",
  });
});
