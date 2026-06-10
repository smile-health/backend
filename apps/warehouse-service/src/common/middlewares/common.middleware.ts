import { createMiddleware } from "hono/factory"

export class CommonMiddleware {
  loadSlaveDB = createMiddleware(async (c, next) => {
    // c.var.slave = slave
    await next()
  })
}
