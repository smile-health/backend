import { Context } from "hono";

export function createMockContext(): Context {
  const mockContext = {
    req: {
      method: "GET",
      url: "http://localhost:3000/test",
      query: () => ({ param: "value" }),
      header: () => ({ "content-type": "application/json" }),
    },
    res: {
      status: 200,
    },
    get: (key: string) => {
      if (key === "requestId") return "test-request-id";
      return undefined;
    },
    error: null,
  } as unknown as Context;

  return mockContext;
}
