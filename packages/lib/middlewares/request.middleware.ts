import { Context } from "hono";
import { createMiddleware } from "hono/factory";
import momentTZ from "moment-timezone";
import { ZodIssueCode } from "zod";
import { ValidationError } from "../error.js";
import i18n from "../i18n.js";
import { Event } from "../rabbitmq/type.js";

declare module "hono" {
  interface Context {
    addError(key: string, error: string, label?: string): void;
    addZodError(message: string, path: (string | number)[]): void;
    addEvent(topic: string, payload: object): void;
    toLocalDate(date: Date, format?: string): string;
  }
}

export class RequestMiddleware {
  #setLanguage(c: Context) {
    let language: string =
      c.req.header("accept-language")?.toLowerCase() ?? "en";
    const allowedLanguage: Array<string> = ["en", "id"];
    const isAllowed = allowedLanguage.some((lang) => lang === language);
    if (!isAllowed) {
      language = "en";
    }

    c.set("language", language);

    i18n.changeLanguage(language);
    c.set("t", i18n.t);
  }

  #validateParamID(c: Context) {
    const { pathname } = new URL(c.req.url);
    if (
      pathname.includes("//") ||
      (pathname.endsWith("/") && !pathname.match(/\/[a-zA-Z0-9-_]+$/))
    ) {
      throw new ValidationError("Id is required");
    }
  }

  #registerContextFunctions(c: Context) {
    c.addError = function (key: string, error: string, label?: string) {
      const field = label ?? c.var.t(`common.${key}`).replace("common.", "");
      const errors = this.var.errors ?? {};
      const errMessage = error.startsWith("validator")
        ? c.var.t(error, { field: field })
        : error;

      errors[key] ??= [];
      errors[key].push(errMessage);
      this.set("errors", errors);
    };

    c.addZodError = (message, path) => {
      const errors = c.get("zodErrors") ?? [];
      errors.push({
        code: ZodIssueCode.custom,
        message,
        path,
      });
      c.set("zodErrors", errors);
    };

    c.addEvent = function (topic: string, payload: object) {
      const events: Event[] = this.var.events ?? [];
      events.push({ topic, payload });
      this.set("events", events);
    };

    c.toLocalDate = function (date: Date, format = "YYYY-MM-DD HH:mm:ss") {
      return momentTZ(date)
        .tz(c.req.header("Timezone") || "UTC")
        .format(format);
    };
  }

  handle = createMiddleware(async (c, next) => {
    this.#setLanguage(c);
    this.#validateParamID(c);
    this.#registerContextFunctions(c);

    await next();
  });
}
