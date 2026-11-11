import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { requestBodyLimit } from "../middlewares/body-limit.middleware";

const MB = 1024 * 1024;

const buildApp = () => {
  const app = new Hono();
  app.use("*", requestBodyLimit({ jsonMb: 1, uploadMb: 2 }));
  app.post("/echo", async (c) => {
    const text = await c.req.text();
    return c.json({ size: text.length });
  });
  return app;
};

const post = (app: Hono, size: number, type: string) =>
  app.request("/echo", {
    method: "POST",
    headers: { "content-type": type },
    body: "a".repeat(size),
  });

describe("requestBodyLimit", () => {
  test("accepts JSON under the JSON limit", async () => {
    const res = await post(buildApp(), MB - 10, "application/json");
    expect(res.status).toBe(200);
  });

  test("rejects JSON over the JSON limit with 413", async () => {
    const res = await post(buildApp(), MB + 10, "application/json");
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ message: "Payload Too Large" });
  });

  test("bodies without a content type use the JSON limit", async () => {
    const app = buildApp();
    const res = await app.request("/echo", {
      method: "POST",
      body: "a".repeat(MB + 10),
    });
    expect(res.status).toBe(413);
  });

  test("multipart uploads get the larger limit", async () => {
    const app = buildApp();
    const type = "multipart/form-data; boundary=x";
    expect((await post(app, MB + 10, type)).status).toBe(200);
    expect((await post(app, 2 * MB + 10, type)).status).toBe(413);
  });
});
