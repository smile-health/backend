import pino from "pino";
import pinoCaller from "pino-caller";

const baseLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: {
    target: process.env.NODE_ENV !== "production" ? "pino-pretty" : "pino",
    options: {
      colorize: process.env.NODE_ENV !== "production",
    },
  },
});

const logger =
  process.env.LOG_CALLER === "true"
    ? pinoCaller(baseLogger, {
        relativeTo: process.cwd(),
      })
    : baseLogger;

export default logger;
