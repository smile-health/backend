import { Context } from "hono";
import { ContentfulStatusCode } from "hono/utils/http-status";
import { StatusCodes } from "http-status-codes";
import { env } from "process";
import { ZodError } from "zod";
import { formatErrors } from "./zod.js";

export class HTTPError extends Error {
  statusCode: ContentfulStatusCode;

  constructor(message: string, statusCode: ContentfulStatusCode) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class BadRequestError extends HTTPError {
  constructor(message: string = "Bad Request") {
    super(message, 400);
  }
}

export class UnauthorizedError extends HTTPError {
  constructor(message: string = "Unauthorized") {
    super(message, 401);
  }
}

export class ForbiddenError extends HTTPError {
  constructor(message: string = "Forbidden") {
    super(message, 403);
  }
}

export class NotFoundError extends HTTPError {
  constructor(message: string = "Not Found") {
    super(message, 404);
  }
}

export class ValidationError extends HTTPError {
  constructor(message: string = "error.message.unprocessable_data") {
    super(message, 422);
  }
}

export const errorHandler = (err: unknown, c: Context) => {
  if (err instanceof HTTPError) {
    return c.json(
      {
        message: c.var.t(err.message),
        errors: c.get("errors"),
      },
      err.statusCode
    );
  } else if (err instanceof ZodError) {
    return c.json(
      {
        message: c.var.t("error.message.unprocessable_data"),
        errors: formatErrors(err, c.var.t),
      },
      StatusCodes.UNPROCESSABLE_ENTITY
    );
  }

  const message = "Internal Server Error";
  if (env.APP_DEBUG) {
    console.error(err);
    return c.json(
      { message, errors: err.stack ?? err },
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }

  return c.json({ message }, StatusCodes.INTERNAL_SERVER_ERROR);
};

export class RetriableError extends Error {
  constructor(message: string = "Consume Error") {
    super(message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
