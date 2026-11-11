import type { Context, MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";

const MB = 1024 * 1024;

const readMb = (name: string, fallback: number) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const DEFAULT_JSON_BODY_LIMIT_MB = 10;
export const DEFAULT_UPLOAD_BODY_LIMIT_MB = 50;

const tooLarge = (c: Context) => c.json({ message: "Payload Too Large" }, 413);

const isUpload = (c: Context) => {
  const type = c.req.header("content-type") ?? "";
  return (
    type.startsWith("multipart/form-data") ||
    type.startsWith("application/octet-stream")
  );
};

/**
 * Caps request body size before it reaches parsing/validation (BA-746).
 * Uploads (multipart / octet-stream, e.g. Excel import) get a larger limit
 * than everything else (JSON, form-urlencoded, text).
 * Override with BODY_LIMIT_JSON_MB / BODY_LIMIT_UPLOAD_MB.
 */
export const requestBodyLimit = (options?: {
  jsonMb?: number;
  uploadMb?: number;
}): MiddlewareHandler => {
  const jsonLimit = bodyLimit({
    maxSize:
      (options?.jsonMb ??
        readMb("BODY_LIMIT_JSON_MB", DEFAULT_JSON_BODY_LIMIT_MB)) * MB,
    onError: tooLarge,
  });
  const uploadLimit = bodyLimit({
    maxSize:
      (options?.uploadMb ??
        readMb("BODY_LIMIT_UPLOAD_MB", DEFAULT_UPLOAD_BODY_LIMIT_MB)) * MB,
    onError: tooLarge,
  });

  return (c, next) => (isUpload(c) ? uploadLimit(c, next) : jsonLimit(c, next));
};
