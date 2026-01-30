import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { WhoPqsRepository } from "./who-pqs.repository.js"
import {
  CreateWhoPqsRequest,
  GetWhoPqsQueryParams,
  RowType,
  UpdateWhoPqsRequest,
  WhoPqsDTO,
} from "./who-pqs.schema.js"
import { z } from "zod"
import { collect, merge } from "@smile-health/lib/utils.js"
import { UserRepository } from "../user/user.repository.js"
import { NotFoundError } from "@smile-health/lib/error.js"
import momentTZ from "moment-timezone"
import { WhoPqsExcel } from "./who-pqs.excel.js"
import { AssetModelRepository } from "../asset-model/asset-model.repository.js"

export class WhoPqsModule {
  constructor(
    private readonly repo: WhoPqsRepository,
    private readonly userRepo: UserRepository,
    private readonly assetModelRepo: AssetModelRepository
  ) {}

  async create(c: Context, body: CreateWhoPqsRequest) {
    const userId = c.get("user")?.id
    let promise: any[] = []

    const createDataPqsCode = {
      code: body.code,
      pqs_type_id: body.pqs_type_id,
      cceigat_description_id: body.cceigat_description_id ?? null,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: userId,
      updated_by: userId,
    }
    const [craete, thresholds] = await Promise.all([
      this.repo.create(c, createDataPqsCode),
      this.repo.getTemperatureThresholds(c, 1, [-86, -25, 2], [-40, -15, 8]),
    ])
    const pqsCodeId = Number(craete.insertId)

    if (body.net_capacity5) {
      const idThresholds5 = thresholds.find(
        (item) =>
          item.is_predefined === 1 &&
          item.min_temperature === 2 &&
          item.max_temperature === 8
      )?.id

      promise.push(
        this.repo.createNetCapacity(c, {
          pqs_code_id: pqsCodeId,
          temperature_threshold_id: idThresholds5,
          net_capacity: body.net_capacity5,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: userId,
          updated_by: userId,
        })
      )
    }

    if (body.net_capacityMin20) {
      const idThresholdsMin20 = thresholds.find(
        (item) =>
          item.is_predefined === 1 &&
          item.min_temperature === -25 &&
          item.max_temperature === -15
      )?.id

      promise.push(
        this.repo.createNetCapacity(c, {
          pqs_code_id: pqsCodeId,
          temperature_threshold_id: idThresholdsMin20,
          net_capacity: body.net_capacityMin20,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: userId,
          updated_by: userId,
        })
      )
    }

    if (body.net_capacityMin86) {
      const idThresholdsMin86 = thresholds.find(
        (item) =>
          item.is_predefined === 1 &&
          item.min_temperature === -86 &&
          item.max_temperature === -40
      )?.id

      promise.push(
        this.repo.createNetCapacity(c, {
          pqs_code_id: pqsCodeId,
          temperature_threshold_id: idThresholdsMin86,
          net_capacity: body.net_capacityMin86,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: userId,
          updated_by: userId,
        })
      )
    }

    await Promise.all(promise)
    return { id: pqsCodeId }
  }

  async list(c: Context, queryParam: GetWhoPqsQueryParams) {
    const { data, total } = await this.repo.list(c, queryParam)

    if (data.length === 0) {
      return new PaginatedResponse(queryParam)
    }

    const ids = collect(data, "id")
    const updatedByIds = collect(data, "updated_by")
    const createdByIds = collect(data, "created_by")

    const [users, netCapacities] = await Promise.all([
      this.userRepo.getByIDsMapped(
        c,
        merge(createdByIds.length ? createdByIds : [0], updatedByIds)
      ),
      this.repo.getListPqsNetCapacities(c, ids),
    ])

    const capacitiesByPqsId = netCapacities.reduce(
      (acc, item) => {
        if (typeof item.pqs_code_id === "number") {
          ;(acc[item.pqs_code_id] ??= []).push(item)
        }
        return acc
      },
      {} as Record<number, (typeof netCapacities)[number][]>
    )

    const whoPqs = data.map((res) => {
      const capacitiesForThisPqs = capacitiesByPqsId[res.id] || []

      const cap5 = capacitiesForThisPqs.find(
        (item) =>
          item.is_predefined === 1 &&
          item.min_temperature === 2 &&
          item.max_temperature === 8
      )

      const capMin20 = capacitiesForThisPqs.find(
        (item) =>
          item.is_predefined === 1 &&
          item.min_temperature === -25 &&
          item.max_temperature === -15
      )

      const capMin86 = capacitiesForThisPqs.find(
        (item) =>
          item.is_predefined === 1 &&
          item.min_temperature === -86 &&
          item.max_temperature === -40
      )

      const capacities = [
        cap5
          ? {
              id: cap5.id,
              capacities5: cap5.net_capacity,
              id_temperature_threshold: cap5.temperature_threshold_id,
            }
          : {
              id: null,
              capacities5: null,
              id_temperature_threshold: null,
            },
        capMin20
          ? {
              id: capMin20.id,
              capacitiesMin20: capMin20.net_capacity,
              id_temperature_threshold: capMin20.temperature_threshold_id,
            }
          : {
              id: null,
              capacitiesMin20: null,
              id_temperature_threshold: null,
            },
        capMin86
          ? {
              id: capMin86.id,
              capacitiesMin86: capMin86.net_capacity,
              id_temperature_threshold: capMin86.temperature_threshold_id,
            }
          : {
              id: null,
              capacitiesMin86: null,
              id_temperature_threshold: null,
            },
      ]

      return {
        ...res,
        capacities,
        user_created_by: res.created_by
          ? (users[res.created_by]?.[0] ?? {})
          : {},
        user_updated_by: res.updated_by
          ? (users[res.updated_by]?.[0] ?? {})
          : {},
      }
    })

    return new PaginatedResponse(queryParam, whoPqs, total)
  }

  async detail(c: Context, id: number) {
    const detail = await this.repo.detail(c, id)

    if (!detail)
      throw new NotFoundError(
        c.var.t("validator.not_exist", { field: "WHO PQS" })
      )

    const [users, netCapacities, assetModel] = await Promise.all([
      this.userRepo.getByIDsMapped(
        c,
        merge([detail.created_by ?? 0], [detail.updated_by ?? 0])
      ),
      this.repo.getListPqsNetCapacities(c, [detail.id]),
      this.assetModelRepo.findOne(c, { pqs_code_id: id }),
    ])

    const capacitiesForThisPqs = Array.isArray(netCapacities)
      ? netCapacities.filter((item) => item.pqs_code_id === detail.id)
      : []

    const cap5 = capacitiesForThisPqs.find(
      (item) =>
        item.is_predefined === 1 &&
        item.min_temperature === 2 &&
        item.max_temperature === 8
    )

    const capMin20 = capacitiesForThisPqs.find(
      (item) =>
        item.is_predefined === 1 &&
        item.min_temperature === -25 &&
        item.max_temperature === -15
    )

    const capMin86 = capacitiesForThisPqs.find(
      (item) =>
        item.is_predefined === 1 &&
        item.min_temperature === -86 &&
        item.max_temperature === -40
    )

    return {
      ...detail,
      is_related_asset: assetModel ? 1 : 0,
      pqs_type: {
        id: detail.pqs_type_id,
        name: detail.pqs_type_name,
      },
      cceigat_description: {
        id: detail.cceigat_description_id,
        name: detail.description,
      },
      capacities: [
        cap5
          ? { id: cap5.id, capacities5: cap5.net_capacity }
          : { id: null, capacities5: null },
        capMin20
          ? { id: capMin20.id, capacitiesMin20: capMin20.net_capacity }
          : { id: null, capacitiesMin20: null },
        capMin86
          ? { id: capMin86.id, capacitiesMin86: capMin86.net_capacity }
          : { id: null, capacitiesMin86: null },
      ],
      user_created_by: detail.created_by
        ? (users[detail.created_by]?.[0] ?? {})
        : {},
      user_updated_by: detail.updated_by
        ? (users[detail.updated_by]?.[0] ?? {})
        : {},
    }
  }

  async export(c: Context, queryParam: GetWhoPqsQueryParams) {
    const data = await this.repo.getExportWhoPqs(c, queryParam)
    const rows: RowType[][] = []

    const ids = data && data.length > 0 ? collect(data, "id") : [0]

    const [netCapacities] = await Promise.all([
      this.repo.getListPqsNetCapacities(c, ids),
    ])

    const transaformedData =
      data.length > 0
        ? data.map((item) => {
            const capacitiesForThisPqs = netCapacities.filter(
              (netCapacity) => netCapacity.pqs_code_id === item.id
            )

            const cap5 = capacitiesForThisPqs.find(
              (item) =>
                item.is_predefined === 1 &&
                item.min_temperature === 2 &&
                item.max_temperature === 8
            )

            const capMin20 =
              capacitiesForThisPqs.find(
                (item) =>
                  item.is_predefined === 1 &&
                  item.min_temperature === -25 &&
                  item.max_temperature === -15
              ) ?? null

            const capMin86 =
              capacitiesForThisPqs.find(
                (item) =>
                  item.is_predefined === 1 &&
                  item.min_temperature === -86 &&
                  item.max_temperature === -40
              ) ?? null

            return {
              ...item,
              capacities5: cap5 ? cap5.net_capacity : null,
              capacitiesMin20: capMin20 ? capMin20.net_capacity : null,
              capacitiesMin86: capMin86 ? capMin86.net_capacity : null,
            }
          })
        : []

    const timezone = c.req.header("Timezone") || "UTC"
    for (const item of transaformedData) {
      const row = [
        item.id,
        item.pqs_code,
        item.pqs_type_name,
        item.description ?? "-",
        item.capacities5 ?? "-",
        item.capacitiesMin20 ?? "-",
        item.capacitiesMin86 ?? "-",
        item.updated_by_name ?? "-",
        item.updated_at
          ? momentTZ(item.updated_at).tz(timezone).format("DD/MM/YYYY HH:mm")
          : "-",
      ]
      rows.push(row)
    }

    const columns = [
      { key: "id", header: "ID", width: 15 },
      { key: "pqs_code", header: c.var.t("who_pqs.label.pqs_code"), width: 15 },
      {
        key: "pqs_type_name",
        header: c.var.t("who_pqs.label.pqs_type"),
        width: 15,
      },
      { key: "cceigat", header: "CCEIGAT", width: 15 },
      { key: "capacities5", header: "+5°C", width: 15 },
      { key: "capacitiesMin20", header: "-20°C", width: 15 },
      { key: "capacitiesMin86", header: "-86°C", width: 15 },
      {
        key: "updated_by_name",
        header: c.var.t("who_pqs.label.updated_by"),
        width: 15,
      },
      {
        key: "updated_at",
        header: c.var.t("who_pqs.label.updated_at"),
        width: 15,
      },
    ]

    const sheet = c.var.t("who_pqs.sheet.who_pqs")
    const excelTemplate = new WhoPqsExcel()
    const language = c.var.language || "en"
    await excelTemplate.initSheet(sheet)

    excelTemplate.setLanguage(language)
    excelTemplate.setTitle(c.var.t("who_pqs.export.title_who_pqs"))
    excelTemplate.setTimezone(c.req.header("Timezone"))
    excelTemplate.setColumns(columns)
    await excelTemplate.addRows(sheet, rows)

    return excelTemplate.generate()
  }

  async update(c: Context, id: number, data: UpdateWhoPqsRequest) {
    const userId = Number(c.get("user")?.id)
    const [getListPqsNetCapacities, thresholds] = await Promise.all([
      this.repo.getListPqsNetCapacities(c, [id], false),
      this.repo.getTemperatureThresholds(c, 1, [-86, -25, 2], [-40, -15, 8]),
    ])
    let promise: any[] = []
    let isNewNetCapacities5, isNewNetCapacitiesMin20, isNewNetCapacitiesMin86

    // update data WhoPqs
    const updateWhoPqs: WhoPqsDTO = {
      code: data.code,
      pqs_type_id: data.pqs_type_id,
      cceigat_description_id: data.cceigat_description_id ?? null,
      updated_at: new Date(),
      updated_by: userId,
    }
    promise.push(this.repo.update(c, updateWhoPqs, { id }))

    // update data existing
    getListPqsNetCapacities.forEach((item) => {
      if (
        item.is_predefined === 1 &&
        item.min_temperature === 2 &&
        item.max_temperature === 8
      ) {
        const updateNetCapacities5 = {
          pqs_code_id: id,
          temperature_threshold_id: item.temperature_threshold_id,
          net_capacity: data.net_capacity5,
          updated_at: new Date(),
          updated_by: userId,
          deleted_at: data.net_capacity5 === null ? new Date() : null,
          deleted_by: data.net_capacity5 === null ? userId : null,
        }
        promise.push(
          this.repo.updateNetCapacity(c, item.id, updateNetCapacities5)
        )
        isNewNetCapacities5 = true
      }

      if (
        item.is_predefined === 1 &&
        item.min_temperature === -25 &&
        item.max_temperature === -15
      ) {
        const updateNetCapacitiesMin20 = {
          pqs_code_id: id,
          temperature_threshold_id: item.temperature_threshold_id,
          net_capacity: data.net_capacityMin20,
          updated_at: new Date(),
          updated_by: userId,
          deleted_at: data.net_capacityMin20 === null ? new Date() : null,
          deleted_by: data.net_capacityMin20 === null ? userId : null,
        }
        promise.push(
          this.repo.updateNetCapacity(c, item.id, updateNetCapacitiesMin20)
        )
        isNewNetCapacitiesMin20 = true
      }

      if (
        item.is_predefined === 1 &&
        item.min_temperature === -86 &&
        item.max_temperature === -40
      ) {
        const updateNetCapacitiesMin86 = {
          pqs_code_id: id,
          temperature_threshold_id: item.temperature_threshold_id,
          net_capacity: data.net_capacityMin86,
          updated_at: new Date(),
          updated_by: userId,
          deleted_at: data.net_capacityMin86 === null ? new Date() : null,
          deleted_by: data.net_capacityMin86 === null ? userId : null,
        }
        promise.push(
          this.repo.updateNetCapacity(c, item.id, updateNetCapacitiesMin86)
        )
        isNewNetCapacitiesMin86 = true
      }
    })

    // create new data net capacity if body net capacity is not null
    const idThresholds5 = thresholds.find(
      (item) =>
        item.is_predefined === 1 &&
        item.min_temperature === 2 &&
        item.max_temperature === 8
    )?.id
    const idThresholdsMin20 = thresholds.find(
      (item) =>
        item.is_predefined === 1 &&
        item.min_temperature === -25 &&
        item.max_temperature === -15
    )?.id
    const idThresholdsMin86 = thresholds.find(
      (item) =>
        item.is_predefined === 1 &&
        item.min_temperature === -86 &&
        item.max_temperature === -40
    )?.id

    if (data.net_capacity5 && !isNewNetCapacities5) {
      promise.push(
        this.repo.createNetCapacity(c, {
          pqs_code_id: id,
          temperature_threshold_id: idThresholds5,
          net_capacity: data.net_capacity5,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: userId,
          updated_by: userId,
        })
      )
    }

    if (data.net_capacityMin20 && !isNewNetCapacitiesMin20) {
      promise.push(
        this.repo.createNetCapacity(c, {
          pqs_code_id: id,
          temperature_threshold_id: idThresholdsMin20,
          net_capacity: data.net_capacityMin20,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: userId,
          updated_by: userId,
        })
      )
    }

    if (data.net_capacityMin86 && !isNewNetCapacitiesMin86) {
      promise.push(
        this.repo.createNetCapacity(c, {
          pqs_code_id: id,
          temperature_threshold_id: idThresholdsMin86,
          net_capacity: data.net_capacityMin86,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: userId,
          updated_by: userId,
        })
      )
    }

    await Promise.all(promise)
    return {}
  }
}
