import { BaseController } from "@/modules/base.controller.js";
import { SentinelSurveillanceModule } from "./sentinel-surveillance.module.js";
import { SentinelSurveillanceMiddleware } from "./sentinel-surveillance.middleware.js";
import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";

export class SentinelSurveillanceController extends BaseController {
  constructor(
    private readonly module: SentinelSurveillanceModule,
    private readonly middleware: SentinelSurveillanceMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/patients",
      this.validateRequest("query", this.middleware.validateNIK),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.getPatients(c, query)

        return c.json(res, StatusCodes.OK)
      }
    )

    router.get(
      "/specimen",
      this.validateRequest("query", this.middleware.validateSpecimensQuery),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.getSpecimens(c, query)

        return c.json(res, StatusCodes.OK)
      }
    )

    router.get(
      "/pcr-lab-result",
      async (c) => {
        const response = await this.module.listPcrLabResult(c)

        return c.json({ data: response }, StatusCodes.OK)
      }
    )


    router.put(
      "/:id",
      this.validateRequest("param", this.middleware.validateIdParam),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.update(c, param.id, body)

        return c.json(
          {
            status: true,
            message: "Sentinel surveillance updated successfully",
            data: [],
          },
          StatusCodes.OK
        )
      }
    )

    router.post(
      "/",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        await this.module.create(c, body)

        return c.json(
          {
            status: true,
            message: "Sentinel surveillance created successfully",
            data: [],
          },
          StatusCodes.CREATED
        )
      }
    )

    router.get(
      "/",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)

        return c.json(res, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", this.middleware.validateSentinelSurveillanceId),
      async (c) => {
        const query = c.req.valid("param")
        const res = await this.module.getDetail(c, Number(query.id))

        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}