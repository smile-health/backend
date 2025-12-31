import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { SyncExampleModule } from "./sync-example.module.js"

export class SyncExampleController extends BaseController {
  constructor(private module: SyncExampleModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post("/", async (c) => {
      const body = await c.req.json()
      const response = await this.module.create(c, body)
      return c.json(response, StatusCodes.CREATED)
    })

    return router
  }
}
