import { EntityActivityRepository } from "@/modules/entity-activity/entity-activity.repository.js"
import { EntityVendorRepository } from "@/modules/entity-vendor/entity-vendor.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { MaterialActivityRepository } from "@/modules/material-activity/material-activity.repository.js"
import { MaterialRepository } from "@/modules/material/material.repository.js"
import { ValidationError } from "@smile/lib/error.js"
import { collect } from "@smile/lib/utils.js"
import { createMiddleware } from "hono/factory"
import { ZodError, ZodIssueCode } from "zod"
import { DinContext } from "./din.context.js"
import { DinRepository } from "./din.repository.js"
import { CreateOrderDinRequest, WSEntitiesSchema } from "./din.schemas.js"

export class DinMiddleware {
  constructor(
    private readonly repo: DinRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly entityRepo: EntityRepository,
    private readonly entityActivityRepo: EntityActivityRepository,
    private readonly materialActivityRepo: MaterialActivityRepository,
    private readonly entityVendorRepo: EntityVendorRepository
  ) {}

  logRequest = createMiddleware(async (c: DinContext, next) => {
    await next()

    const { orderId, client, requestType } = c.var

    const res = c.res.clone()
    await this.repo.createLog({
      client_id: client.id,
      source_id: orderId,
      source_type: "order",
      flow: "in",
      tag: requestType ?? "create_order",
      request: JSON.stringify({
        method: c.req.method,
        url: c.req.url,
        body: await c.req.text(),
      }),
      response: JSON.stringify({
        status: c.res.status,
        body: await res.text(),
        error: c.error,
      }),
    })
  })

  validateRequest = async (c: DinContext, data: CreateOrderDinRequest) => {
    c.addZodError = (message, path) => {
      const errors = c.get("zodErrors") ?? []
      errors.push({
        code: ZodIssueCode.custom,
        message,
        path,
      })
      c.set("zodErrors", errors)
    }

    const activityId = await this.repo.getInternalId(
      c,
      "activity",
      data.program[0]!
    )
    if (!activityId) {
      throw new ValidationError(`Program ${data.program[0]} is not mapped`)
    }

    const activity = await this.repo.getActivity(c, activityId)
    if (!activity) {
      throw new ValidationError(`Activity with id ${activityId} is not found`)
    }

    const programId = activity.program_id
    c.set("programId", programId)
    c.set("activityIds", await this.repo.getActivityIds(c, programId))

    const kfa_codes = [...new Set(collect(data.data, "kfa_code"))]

    const [materialsExist, entitiesExist] = await Promise.all([
      this.materialRepo.find(c, { code: kfa_codes }),
      this.entityRepo.find(c, {
        id_satu_sehat: [data.pengirim.kode, data.penerima.kode],
      }),
    ])
    const entityIdCustomer = entitiesExist.find(
      (e) => e.id_satu_sehat === Number(data.penerima.kode)
    )
    const entityIdVendor = entitiesExist.find(
      (e) => e.id_satu_sehat === Number(data.pengirim.kode)
    )

    await this.#isCustomerBelongsToVendor(
      c,
      entityIdCustomer?.id ?? 0,
      entityIdVendor?.id ?? 0
    )

    this.#isVendorAndCustomerExist(
      c,
      entitiesExist,
      Number(data.pengirim.kode).toString(),
      Number(data.penerima.kode).toString()
    )

    await this.#isEntityActivityCostumer(
      c,
      entityIdCustomer?.id ?? 0,
      activityId ?? 0
    )

    // collect material ids
    const materialIdsExist =
      materialsExist.length > 0
        ? [...new Set(collect(materialsExist, "id"))]
        : [0]

    const materialActivities = await this.materialActivityRepo.find(c, {
      material_id: materialIdsExist,
      activity_id: activityId ?? 0,
    })

    for (const [dataIndex, dataItems] of data.data.entries()) {
      const { kfa_code } = dataItems

      const isMaterialExist = materialsExist.find((m) => m.code === kfa_code)

      const materialActivity = materialActivities.find(
        (val) =>
          val.material_id == isMaterialExist?.id &&
          val.activity_id == activityId
      )
      if (!materialActivity) {
        c.addZodError("validator.not_exist", [
          "data",
          dataIndex,
          "material activity",
        ])
      }

      this.#isMaterialExist(c, dataIndex.toString(), isMaterialExist, kfa_code)
    }

    const errors = c.get("zodErrors") ?? []
    if (errors.length > 0) {
      throw new ZodError(errors)
    }

    c.set("dataExtra", {
      activityId: activityId,
      detailEntitasVendor: entitiesExist.find(
        (e) => e.id_satu_sehat === Number(data.pengirim.kode)
      ),
      detailEntitasCustomer: entitiesExist.find(
        (e) => e.id_satu_sehat === Number(data.penerima.kode)
      ),
      listMaterial: materialsExist,
    })
  }

  readonly #isEntityActivityCostumer = async (
    c: DinContext,
    customerId: number,
    activityId: number
  ) => {
    const record =
      await this.entityActivityRepo.getActivityByEntityIdAndActivityId(
        c,
        customerId,
        activityId
      )

    if (!record) {
      c.addZodError("validator.not_exist", ["activity_id_customer"])
    }
  }

  readonly #isMaterialExist = async (
    c: DinContext,
    index: string,
    material?: { id: number },
    kfaCode?: string
  ) => {
    if (!material) {
      c.addZodError(
        c.var.t("validator.not_exist_with_value", {
          field: "kfa_code",
          value: kfaCode,
        }),
        ["data", index, "kfa_code"]
      )
    }
  }

  readonly #isVendorAndCustomerExist = (
    c: DinContext,
    data: WSEntitiesSchema[],
    kodePengirim: string,
    kodePenerima: string
  ) => {
    const isVendorExist = data.find(
      (item) => item.id_satu_sehat?.toString() === kodePengirim
    )
    const isCustomerExist = data.find(
      (item) => item.id_satu_sehat?.toString() === kodePenerima
    )

    if (!isVendorExist) {
      c.addZodError("validator.not_exist", ["kode_pengirim"])
    }

    if (!isCustomerExist) {
      c.addZodError("validator.not_exist", ["kode_penerima"])
    }
  }

  readonly #isCustomerBelongsToVendor = async (
    c: DinContext,
    customerId: number,
    vendorId: number
  ) => {
    const vendors = await this.#getCustomerVendors(c, customerId)

    const vendor = vendors.find((vendor) => vendor.id === vendorId)
    if (!vendor) {
      c.addZodError("validator.not_exist", ["penerima_pengirim"])
    }
  }

  async #getCustomerVendors(c: DinContext, customer_id: number) {
    const vendors = await this.entityVendorRepo.getVendorsEntityTag(
      c,
      customer_id
    )

    return vendors.result.vendors
  }
}
