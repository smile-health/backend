import { ValidationError } from "@smile-health/lib/error.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { UpdateResult } from "kysely"
import moment from "moment"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { EntityTemplate } from "./entity.excel.js"
import { EntityPublisher } from "./entity.publisher.js"
import { EntityRepository } from "./entity.repository.js"
import {
  GetEntitiesQueries,
  GetInactiveEntityNotificationQueries,
  ImportSchemaRequest,
  UpdateStatusEntitiesRequest,
  UpdateStatusVendorEntitiesRequest,
} from "./entity.schema.js"

import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { BaseModule } from "../base.module.js"
import { UserRepository } from "../user/user.repository.js"
import { EntityCron } from "./entity.cron.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"

export class EntityModule extends BaseModule {
  constructor(
    private readonly entityRepo: EntityRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    protected readonly publisher: EntityPublisher,
    private readonly userRepo: UserRepository,
    private readonly notificationPublisher: Publisher,
    private readonly notificationTypeRepo: NotificationTypeRepository
  ) {
    super(exportHistoryRepo, publisher)
  }

  async #checkActiveOrder(c: Context, id: number) {
    const isHasActiveOrder = await this.entityRepo.checkActiveOrder(c, id)
    if (isHasActiveOrder) {
      throw new ValidationError("ENTITY HAS ACTIVE ORDER")
    }
  }

  async #checkCustomerVendorRelation(c: Context, status: number, id: number) {
    if (status === 0) {
      const isHasRelation = await this.entityRepo.checkRelationCustomerVendor(
        c,
        id
      )
      if (isHasRelation) {
        throw new ValidationError("ENTITY HAS RELATION")
      }
    }
  }

  async list(c: Context, params: GetEntitiesQueries) {
    params.program_id = c.var.programId
    const { list, total } = await this.entityRepo.getListEntity(c, params)

    const parsedListEntity = list.map((entity) => {
      return {
        id: entity.id,
        name: entity.name ?? "-",
        location: entity.location ?? "-",
        entity_tag_name: entity.tag ?? "-",
        is_open_vial: entity.is_open_vial,
        code: entity.code ?? "-",
        status: entity.status,
        province_id: entity.province_id,
        regency_id: entity.regency_id,
        sub_district_id: entity.sub_district_id,
        village_id: entity.village_id,
        id_satu_sehat: entity.id_satu_sehat,
        province:
          entity.province_id && entity.province_name
            ? {
                id: entity.province_id,
                name: entity.province_name,
              }
            : null,
        regency:
          entity.regency_id && entity.regency_name
            ? {
                id: entity.regency_id,
                name: entity.regency_name,
              }
            : null,
        sub_district:
          entity.sub_district_id && entity.sub_district_name
            ? {
                id: entity.sub_district_id,
                name: entity.sub_district_name,
              }
            : null,
      }
    })

    return new PaginatedResponse(params, parsedListEntity, total)
  }

  async detail(c: Context, id: number) {
    const entityDetail = await this.entityRepo.getEntityDetail(
      c,
      id,
      c.var.programId
    )
    if (!entityDetail) {
      throw new ValidationError(
        c.var.t("validator.not_exist", { field: "entity" })
      )
    }

    return {
      status: entityDetail.status,
      id: entityDetail.id,
      name: entityDetail.name ?? "-",
      location: entityDetail.location ?? "-",
      lat: entityDetail.lat ?? "-",
      lng: entityDetail.lng ?? "-",
      type: entityDetail.type ?? "-",
      entity_tag_name: entityDetail.entity_tag_name ?? "-",
      is_open_vial: entityDetail.is_open_vial,
      code: entityDetail.code ?? "-",
      id_satu_sehat: entityDetail.id_satu_sehat ?? "-",
      address: entityDetail.address ?? "-",
      is_vendor: entityDetail.is_vendor,
      last_update: entityDetail.updated_at
        ? moment(entityDetail.updated_at).format("DD/MM/YYYY HH:mm:ss")
        : "-",
      is_relocation: entityDetail.is_relocation,
    }
  }

  async export(c: Context, params: GetEntitiesQueries) {
    params.program_id = c.var.programId

    return await this.handleAsyncExport(c, TOPIC.ENTITY_PROGRAM_EXPORTED, {
      filename: c.var.t("common.entity"),
      params,
    })
  }

  async updateStatus(
    c: Context,
    id: number,
    reqBody: UpdateStatusEntitiesRequest
  ) {
    const { status } = reqBody
    await this.#checkActiveOrder(c, id)
    await this.#checkCustomerVendorRelation(c, status, id)

    const { numUpdatedRows, numChangedRows } =
      await this.entityRepo.updateStatusEntity(c, status, id, c.var.programId)
    if (numUpdatedRows === 0n && numChangedRows === 0n)
      throw new ValidationError("ENTITY NOT FOUND")

    await this.entityRepo.update(c, {}, { id })
    await this.publisher.processUpdate(c, id, { status: reqBody.status })

    return {
      message: "SUCCESSFULLY_UPDATED",
    }
  }

  async updateStatusVendor(
    c: Context,
    id: number,
    reqBody: UpdateStatusVendorEntitiesRequest
  ) {
    const { status, is_relocation } = reqBody
    const { numUpdatedRows, numChangedRows } =
      await this.entityRepo.updateStatusVendorEntity(
        c,
        status,
        is_relocation,
        id,
        c.var.programId
      )
    if (numUpdatedRows === 0n && numChangedRows === 0n)
      throw new ValidationError(
        c.var.t("validator.not_exist", { field: "entity" })
      )

    await this.entityRepo.update(c, {}, { id })
    await this.publisher.processUpdate(c, id, { is_vendor: reqBody.status })

    return {
      message: "SUCCESSFULLY_UPDATED",
    }
  }

  async getTemplate(c: Context) {
    const language = c.var.language
    const title = language === "en" ? "Entity" : "Entitas"
    const filename = `entity_${language.toLowerCase()}.xlsx`
    const excelTemplate = new EntityTemplate()
    excelTemplate.setTitle(`${title} Template`)
    await excelTemplate.loadFile(filename)
    return await excelTemplate.generateTemplate()
  }

  async import(c: Context, rows: ImportSchemaRequest[]) {
    const bulkProcess: Promise<UpdateResult>[] = []
    for (const entity of rows) {
      const { EntityId, IsVendor, Status, IsRelocation } = entity

      bulkProcess.push(
        this.entityRepo.updateEntityProgram(c, Number(EntityId), {
          is_vendor: Number(IsVendor!),
          status: Number(Status!),
          is_relocation: Number(IsRelocation!),
        })
      )
    }

    await Promise.all(bulkProcess)
    return rows.length
  }

  async triggerInactiveEntityNotification(
    c: Context,
    query: GetInactiveEntityNotificationQueries
  ) {
    const entityCron = new EntityCron(
      this.entityRepo,
      this.userRepo,
      this.notificationPublisher,
      this.notificationTypeRepo
    )

    await entityCron.handleInactiveEntityNotif(c, c, c.var.t, query)

    return {
      message: "Inactive entity notification process completed successfully",
    }
  }
}
