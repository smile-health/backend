import { Hono } from "hono"
import { TargetsModule } from "./targets.module.js"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { TargetsMiddleware } from "./targets.middleware.js"
import {
  SummaryRequestSchema,
  NikListRequestSchema,
  SummaryDetailRequestSchema,
  GroupedSummaryRequestSchema,
} from "./targets.schema.js"

export class TargetsController extends BaseController {
  constructor(
    private readonly targetsModule: TargetsModule,
    private readonly middleware: TargetsMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/targets",
      this.validateRequest("query", NikListRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.targetsModule.getNikList(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/targets",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const userId = c.var.userEntity?.global_id
        const body = c.req.valid("json")
        const response = await this.targetsModule.create(c, body, userId)
        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/targets/nik/:nik",
      this.validateRequest("param", this.middleware.validateNIKIdentity),
      async (c) => {
        const { nik } = c.req.valid("param")
        const res = await this.targetsModule.getIdentityAndAddressByNIK(c, nik)
        return c.json(res)
      }
    )

    router.get(
      "/targets/summary",
      this.validateRequest("query", SummaryRequestSchema),
      async (c) => {
        const subDistrictId = c.var.userEntity?.sub_district_id || ""
        const query = c.req.valid("query")
        const res =
          await this.targetsModule.getSummaryTargetsMicroplanByIdealDate(
            c,
            query,
            Number(subDistrictId)
          )
        return c.json(res, StatusCodes.OK)
      }
    )

    router.get("/target-groups", async (c) => {
      const res = await this.targetsModule.getTargetGroup(c)

      return c.json(res)
    })

    router.get(
      "/targets/summary/grouped",
      this.validateRequest("query", GroupedSummaryRequestSchema),
      async (c) => {
        const sub_district_id = c.var.userEntity?.sub_district_id || ""
        const query = c.req.valid("query")
        const response = await this.targetsModule.getGroupedSummary(
          c,
          query,
          sub_district_id
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/targets/summary/:target_group_id",
      this.validateRequest("param", SummaryDetailRequestSchema),
      async (c) => {
        const sub_district_id = c.var.userEntity?.sub_district_id || ""
        const param = c.req.valid("param")
        const response =
          await this.targetsModule.getSummaryDetailsWithTargetGroupId(
            c,
            param,
            sub_district_id
          )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/targets/:nik",
      this.validateRequest("param", this.middleware.validateNIKIdentity),
      async (c) => {
        const { nik } = c.req.valid("param")
        const res = await this.targetsModule.getDetail(c, nik)
        return c.json(res)
      }
    )

    router.put(
      "/targets/:nik",
      this.validateRequest("param", this.middleware.validateNIKIdentity),
      this.validateRequest("json", (c) => {
        const nik = c.req.param("nik") as string
        return this.middleware.update(c, nik)
      }),
      async (c) => {
        const body = c.req.valid("json")
        const { nik } = c.req.valid("param")
        const res = await this.targetsModule.updateTargetData(c, nik, body)
        return c.json(res)
      }
    )

    router.delete(
      "/targets/:nik",
      this.validateRequest("param", this.middleware.validateNIKIdentity),
      async (c) => {
        const { nik } = c.req.valid("param")
        const res = await this.targetsModule.deleteDataByNIK(c, nik)
        return c.json(
          res,
          res.status ? StatusCodes.OK : StatusCodes.UNPROCESSABLE_ENTITY
        )
      }
    )

    return router
  }
}
