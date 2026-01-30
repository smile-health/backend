import { swaggerUI } from "@hono/swagger-ui"
import { OpenAPIHono } from "@hono/zod-openapi"
import { errorHandler } from "@smile-health/lib/error.js"
import { basicAuth } from "hono/basic-auth"
import { env } from "process"
import {
  dinApp,
  consumer as integrationWorker,
  sihaApp,
} from "./modules/order-integration/index.js"
import { wmsApp } from "./modules/disposal/integration/wms/index.js"

export const app = new OpenAPIHono<object>({
  defaultHook: (result, c) => {
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
    title: "Integration Service API",
  },
  servers: [
    {
      url: `${appPrefix}${serverURL}`,
    },
  ],
})

sihaApp.registerRoutes(app)
dinApp.registerRoutes(app)
wmsApp.registerRoutes(app)

await integrationWorker.start()
