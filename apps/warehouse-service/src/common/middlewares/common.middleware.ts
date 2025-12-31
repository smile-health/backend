import { createMiddleware } from "hono/factory"

export class CommonMiddleware {
  loadSlaveDB = createMiddleware(async (c, next) => {
    // c.var.slave = slave
    await next()
  })

  loadElasticClient = createMiddleware(async (c, next) => {
    // This is a placeholder for loading the Elastic client
    // In a real implementation, this would initialize the Elastic client
    // c.var.elastic = {}
    await next()
  })
}
