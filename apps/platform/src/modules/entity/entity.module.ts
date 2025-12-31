import { MAP_ENTITY_TYPE_LABEL } from "@smile/lib/types/entity.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { ExportTemplate } from "@smile/lib/excel.js"
import { ValidationError } from "@smile/lib/error.js"
import { Context } from "hono"
import momentTZ from "moment-timezone"
import moment from "moment"
import { EntityRepository } from "./entity.repository.js"
import {
  GetEntitiesQueries,
  UpdateStatusEntitiesRequest,
} from "./entity.schema.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { TGlobalEntityDto } from "@smile/lib/types/global.schema.js"
import { DB } from "@/common/infrastructure/database/types/db.js"

export class EntityModule {
  constructor(private entityRepo: EntityRepository) {}

  async #checkActiveOrder(c: Context, id: number) {
    const isHasActiveOrder = await this.entityRepo.checkActiveOrder(c, id)
    if (isHasActiveOrder) {
      throw new ValidationError("ENTITY HAS ACTIVE ORDER")
    }
  }

  async #checkCustomerVendorRelation(c: Context, status: number) {
    if (status === 0) {
      const isHasRelation = await this.entityRepo.checkRelationCustomerVendor(
        c,
        status
      )
      if (isHasRelation) {
        throw new ValidationError("ENTITY HAS RELATION")
      }
    }
  }

  #generateStatusLabel(c: Context, item): string {
    let status = c.var.t("common.inactive")
    if (item.status === 1) {
      status = c.var.t("common.active")
    }

    return status
  }

  #generateStatusVendorLabel(c: Context, item): string {
    let status = c.var.t("common.no")
    if (item.is_vendor === 1) {
      status = c.var.t("common.yes")
    }

    return status
  }

  #generateColumnEntityExcel(c: Context) {
    return [
      { header: c.var.t("entity.label.id_province"), width: 15 },
      { header: c.var.t("entity.label.province"), width: 30 },
      {
        header: c.var.t("entity.label.id_regency"),
        width: 20,
      },
      { header: c.var.t("entity.label.regency"), width: 35 },
      {
        header: c.var.t("entity.label.id_sub_district"),
        width: 20,
      },
      { header: c.var.t("entity.label.sub_district"), width: 30 },
      { header: c.var.t("entity.label.id_village"), width: 20 },
      { header: c.var.t("entity.label.village"), width: 30 },
      { header: c.var.t("entity.label.id_entity"), width: 15 },
      { header: c.var.t("entity.label.name"), width: 60 },
      { header: c.var.t("entity.label.code"), width: 20 },
      { header: c.var.t("entity.label.type"), width: 15 },
      { header: c.var.t("entity.label.entity_tag"), width: 35 },
      { header: c.var.t("entity.label.address"), width: 70 },
      { header: c.var.t("entity.label.status"), width: 10 },
      {
        header: c.var.t("entity.label.is_vendor"),
        width: 15,
      },
      {
        header: c.var.t("entity.label.update_at"),
        width: 15,
      },
      {
        header: c.var.t("entity.label.created_by"),
        width: 20,
      },
    ]
  }

  async #generateRowEntityExcel(c: Context, stream) {
    const rows: (string | number)[][] = []
    for await (const item of stream) {
      const statusActive = this.#generateStatusLabel(c, item)
      const statusVendor = this.#generateStatusVendorLabel(c, item)
      const row = [
        item.province_id || "-",
        item.province_name || "-",
        item.regency_id || "-",
        item.regency_name || "-",
        item.sub_district_id || "-",
        item.sub_district_name || "-",
        item.village_id || "-",
        item.village_name || "-",
        `${item.id}` || "-",
        item.name || "-",
        item.code || "-",
        MAP_ENTITY_TYPE_LABEL[item.type ?? "-"] || "-",
        item.entity_tag_name || "-",
        item.address || "-",
        statusActive,
        statusVendor,
        item.updated_at
          ? moment(item.updated_at).locale(c.var.language).format("DD MMM YYYY")
          : "-",
        item.full_user_name || "-",
      ]

      rows.push(row)
    }

    return rows
  }

  async list(c: Context, params: GetEntitiesQueries) {
    const [listEntity, totalEntity] = await Promise.all([
      this.entityRepo.getListEntity(c, params),
      this.entityRepo.getTotalCountEntity(c, params),
    ])

    const parsedListEntity = listEntity.map((entity) => {
      return {
        id: entity.id,
        name: entity.name || "-",
        location: entity.location || "-",
        entity_tag_name: entity.entity_tag_name || "-",
        code: entity.code || "-",
        status: entity.status,
      }
    })

    return new PaginatedResponse(params, parsedListEntity, totalEntity)
  }

  async detail(c: Context, id: number) {
    const entityDetail = await this.entityRepo.getEntityDetail(c, id)
    if (!entityDetail) {
      throw new ValidationError("Entity not exist")
    }

    return {
      status: entityDetail.status,
      id: entityDetail.id,
      name: entityDetail.name || "-",
      location: entityDetail.location || "-",
      lat: entityDetail.lat || "-",
      lng: entityDetail.lng || "-",
      type: MAP_ENTITY_TYPE_LABEL[entityDetail.type ?? "-"] || "-",
      entity_tag_name: entityDetail.entity_tag_name || "-",
      code: entityDetail.code || "-",
      address: entityDetail.address || "-",
      is_vendor: entityDetail.is_vendor,
      last_update: entityDetail.updated_at
        ? moment(entityDetail.updated_at).format("DD/MM/YYYY HH:mm:ss")
        : "-",
    }
  }

  async syncGlobalEntity(c: CustomContext<DB>, req: TGlobalEntityDto) {
    const entity = await this.entityRepo.findByCodeOrGlobalId(
      c,
      req.code,
      req.global_id
    )

    if (entity) {
      await this.entityRepo.updateFromGlobalEntity(c, req, entity.id)
    } else {
      await this.entityRepo.createFromGlobalEntity(c, req)
    }
  }

  async export(c: Context, params: GetEntitiesQueries) {
    const stream = await this.entityRepo.getEntitiesStreamData(c, params)
    const rows = await this.#generateRowEntityExcel(c, stream)
    const columns = this.#generateColumnEntityExcel(c)

    // Create Excel File
    const excelTemplate = new ExportTemplate("Entity")
    excelTemplate.createTable({
      tableName: "Entities",
      startCell: "A1",
      columns,
      rows,
    })

    const timezoneHeader = c.req.header("Timezone") || "UTC"
    const currentTime = momentTZ().tz(timezoneHeader)
    const formatDate =
      moment().format("MM-DD-YYYY HH_mm_ss") +
      " GMT" +
      currentTime.format("Z").replace(":00", "")
    const filename = `Entity ${formatDate}`

    return excelTemplate.generate(filename)
  }

  async updateStatus(
    c: Context,
    id: number,
    reqBody: UpdateStatusEntitiesRequest
  ) {
    const { status } = reqBody
    await this.#checkActiveOrder(c, id)
    await this.#checkCustomerVendorRelation(c, status)

    const { numUpdatedRows, numChangedRows } =
      await this.entityRepo.updateStatusEntity(c, status, id)
    if (numUpdatedRows === 0n && numChangedRows === 0n)
      throw new ValidationError("ENTITY NOT FOUND")

    return {
      message: "SUCCESSFULLY_UPDATED",
    }
  }

  async updateStatusVendor(
    c: Context,
    id: number,
    reqBody: UpdateStatusEntitiesRequest
  ) {
    const { status } = reqBody
    const { numUpdatedRows, numChangedRows } =
      await this.entityRepo.updateStatusVendorEntity(c, status, id)
    if (numUpdatedRows === 0n && numChangedRows === 0n)
      throw new ValidationError("ENTITY NOT FOUND")

    return {
      message: "SUCCESSFULLY_UPDATED",
    }
  }
}
