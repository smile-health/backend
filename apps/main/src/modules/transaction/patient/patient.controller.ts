import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { PatientModule } from "./patient.module.js"
import {
  PatientDetailRequestSchema,
  PatientVaccineSequenceRequestSchema,
} from "./patient.schema.js"
export class PatientController extends BaseController {
  constructor(private readonly module: PatientModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/patient/:nik",
      this.validateRequest("param", PatientDetailRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.getDetail(c, { nik: param.nik })

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/patient/:nik/location",
      this.validateRequest("param", PatientDetailRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.getLocationByNik(c, {
          nik: param.nik,
        })

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/patient/:nik/:protocol_id/vaccine-sequence",
      this.validateRequest("param", PatientVaccineSequenceRequestSchema),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.getVaccineSequence(c, {
          nik: param.nik,
          protocol_id: param.protocol_id,
        })

        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
