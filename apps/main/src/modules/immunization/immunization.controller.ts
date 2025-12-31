import { BaseController } from "@smile/lib/base/controller.js"
import { ImmunizationModule } from "./immunization.module.js"
import { ImmunizationMiddleware } from "./immunization.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"

export class ImmunizationController extends BaseController {
  constructor(
    private readonly module: ImmunizationModule,
    private readonly middleware: ImmunizationMiddleware
  ) {
    super()
  }

  readonly #getSubDistrictId = (c: any) =>
    Number(c.var.userEntity?.sub_district_id || 0)

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/nik/:nik",
      this.validateRequest("param", this.middleware.validateNIK),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.getDetailIdentity(c, param.nik)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.create(c, body)

        return c.json(
          {
            status: true,
            message: "Success create child registration",
            data: response,
          },
          StatusCodes.CREATED
        )
      }
    )

    router.post(
      "/temporary-nik",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        const response = await this.module.createTemporaryNIK(c, body)

        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.put(
      "/temporary-nik/:id",
      this.validateRequest("param", this.middleware.validateId),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const response = await this.module.updateTemporaryNIK(
          c,
          Number(param.id),
          body
        )

        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/weighing-history",
      this.validateRequest("json", this.middleware.createWeighingHistory),
      async (c) => {
        const body = c.req.valid("json")
        const result = await this.module.createWeighingHistory(c, body)

        return c.json(result, StatusCodes.CREATED)
      }
    )

    router.put(
      "/weighing-history/:id",
      this.validateRequest("param", this.middleware.validateWeighingHistoryId),
      this.validateRequest("json", this.middleware.updateWeighingHistory),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        const result = await this.module.updateWeighingHistory(
          c,
          Number(param.id),
          body
        )

        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/weighing-history/:patient_immunization_id",
      this.validateRequest(
        "param",
        this.middleware.validatePatientImmunizationId
      ),
      async (c) => {
        const param = c.req.valid("param")
        const result = await this.module.getWeighingHistoryList(
          c,
          Number(param.patient_immunization_id)
        )

        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const query = c.req.valid("query")
        const page = await this.module.list(c, query, this.#getSubDistrictId(c))

        return c.json(page, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", this.middleware.validateImmunizationId),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.detail(c, Number(param.id))

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id/vaccine",
      this.validateRequest("param", this.middleware.validateImmunizationId),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.getImmunizationStatus(
          c,
          Number(param.id)
        )

        return c.json(response, StatusCodes.OK)
      }
    )

    router.patch(
      "/:patient_id/vaccine/:vaccine_id",
      this.validateRequest("json", this.middleware.updateStatus),
      async (c) => {
        const { patient_id, vaccine_id } = c.req.param()
        const body = c.req.valid("json")

        const response = await this.module.updateImmunizationStatus(
          c,
          Number(patient_id),
          Number(vaccine_id),
          body
        )

        return c.json(response, StatusCodes.OK)
      }
    )

    router.delete(
      "/:id/discard",
      this.validateRequest("param", this.middleware.validateWeighingHistoryId),
      async (c) => {
        const param = c.req.valid("param")
        const result = await this.module.discardDraft(c, Number(param.id))

        return c.json(result, StatusCodes.OK)
      }
    )

    router.put(
      "/:id/status",
      this.validateRequest("param", this.middleware.validateWeighingHistoryId),
      async (c) => {
        const param = c.req.valid("param")
        const result = await this.module.updateWeighingHistoryStatus(
          c,
          Number(param.id)
        )

        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
