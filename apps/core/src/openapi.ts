import { swaggerUI } from "@hono/swagger-ui"
import { OpenAPIHono } from "@hono/zod-openapi"
import { errorHandler } from "@smile-health/lib/error.js"
import { basicAuth } from "hono/basic-auth"
import { env } from "process"
import { commonApp, iotApp } from "./modules/integration"
import { RequestMiddleware } from "@smile-health/lib/middlewares"

export const app = new OpenAPIHono<object>({
  defaultHook: (result, c) => {
    console.log(result.success)
    if (!result.success) {
      return errorHandler(result.error, c)
    }
  },
})

const appPrefix = env.API_PREFIX ?? ""
const serverURL = "/api"
const docURL = "/api/doc"
const securedPaths = [serverURL, docURL]

// Register security scheme if needed (example with Bearer token)
app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
})

app.use("*", async (c, next) => {
  const path = c.req.path

  if (
    !securedPaths.includes(path) ||
    !env.SWAGGER_USERNAME ||
    !env.SWAGGER_PASSWORD
  ) {
    return await next()
  }

  const auth = basicAuth({
    username: env.SWAGGER_USERNAME,
    password: env.SWAGGER_PASSWORD,
  })
  return auth(c, next) // apply auth here
})

app.use("*", new RequestMiddleware().handle)

app.onError((err, c) => {
  if (err instanceof Error) {
    return errorHandler(err, c)
  }
})

// Swagger UI at /ui
app.get(
  "/",
  swaggerUI({
    url: `${appPrefix}${docURL}`,
  })
)

// OpenAPI documentation at /doc
app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "Core Service API",
  },
  servers: [
    {
      url: `${appPrefix}${serverURL}`,
    },
  ],
})

commonApp.registerRoutes(app)
iotApp.registerRoutes(app)
