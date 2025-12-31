import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { ProtocolModule } from "./protocol.module.js"
import {
  DeleteProtocolMaterialActivitySchema,
  GetListProtocolSchema,
  GetListVaccineSequenceSchema,
  ProtocolMateralActivitySchema,
  SequenceSchema,
  StatusProtocolSchema,
} from "./protocol.schema.js"

export class ProtocolController extends BaseController {
  constructor(private readonly module: ProtocolModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/",
      this.validateRequest("query", GetListProtocolSchema),
      async (c) => {
        const query = c.req.valid("query")
        const res = await this.module.list(c, query)
        return c.json(res, StatusCodes.OK)
      }
    )

    router.get(
      "/:protocolId/vaccine-sequences",
      this.validateRequest("param", SequenceSchema),
      this.validateRequest("query", GetListVaccineSequenceSchema),
      async (c) => {
        const { protocolId } = c.req.valid("param")
        const query = c.req.valid("query")
        const res = await this.module.listVaccineSequence(
          c,
          Number(protocolId),
          query
        )
        return c.json(res, StatusCodes.OK)
      }
    )

    router.post(
      "/material-activities",
      this.validateRequest("json", ProtocolMateralActivitySchema),
      async (c) => {
        const body = c.req.valid("json")
        const res = await this.module.setProtocolMaterialActivities(c, body)
        return c.json(res, StatusCodes.OK)
      }
    )

    router.get(
      "/:protocolId/material-activities",
      this.validateRequest("param", SequenceSchema),
      this.validateRequest("query", GetListProtocolSchema),
      async (c) => {
        const { protocolId } = c.req.valid("param")
        const params = c.req.valid("query")
        const res = await this.module.getMaterialActivitiesByProtocolId(
          c,
          Number(protocolId),
          params
        )
        return c.json(res, StatusCodes.OK)
      }
    )

    router.delete(
      "/:protocolId/material-activities/:id",
      this.validateRequest("param", DeleteProtocolMaterialActivitySchema),
      async (c) => {
        const { id } = c.req.valid("param")
        console.log("id", id)
        const res = await this.module.deleteProtocolFromMaterialActivities(
          c,
          Number(id)
        )
        return c.json(res, StatusCodes.OK)
      }
    )

    router.put(
      "/:protocolId/status",
      this.validateRequest("param", SequenceSchema),
      this.validateRequest("json", StatusProtocolSchema),
      async (c) => {
        const { protocolId } = c.req.valid("param")
        const body = c.req.valid("json")
        const res = await this.module.updateStatusProtocol(
          c,
          Number(protocolId),
          body
        )
        return c.json(res, StatusCodes.OK)
      }
    )

    return router
  }
}
