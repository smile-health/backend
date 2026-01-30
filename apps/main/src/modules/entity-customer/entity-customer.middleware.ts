import { ValidationError } from "@smile-health/lib/error.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { MasterData } from "@smile-health/lib/types/param.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { EntityCustomerRepository } from "./entity-customer.repository.js"
import {
  CreateEntityCustomerRequestSchema,
  DeleteEntityCustomerRequestSchema,
  EntityActivitiesDTO,
  EntityCustomerDTO,
  ImportEntityCustomerRequest,
  UpdateEntityCustomerRequestSchema,
  UpdateImportEntityCustomerRequest,
} from "./entity-customer.schema.js"

export class EntityCustomerMiddleware {
  constructor(private readonly entityCustomerRepo: EntityCustomerRepository) {}
  async #validateEntityID(c: Context, listEntityID: number[]) {
    if (listEntityID.length > 0) {
      const listEntity = await this.entityCustomerRepo.getListEntity(
        c,
        listEntityID
      )

      for (const id of listEntityID) {
        const existingIds = listEntity.some((item) => item.id === id)
        if (!existingIds) {
          throw new ValidationError("SOME ENTITY ID IS INVALID")
        }
      }
    }
  }

  async #validateActivityID(c: Context, listActivityID: number[]) {
    if (listActivityID.length > 0) {
      const listActivity = await this.entityCustomerRepo.getListActivity(
        c,
        listActivityID,
        c.get("programId")
      )
      for (const id of listActivityID) {
        const existingIds = listActivity.some((item) => item.id === id)
        if (!existingIds) {
          throw new ValidationError("SOME ACTIVITY ID IS INVALID")
        }
      }
    }
  }

  #validateDuplicateActivity(
    c: Context,
    row: UpdateImportEntityCustomerRequest,
    rowIdx: string,
    rowsDataEntry: UpdateImportEntityCustomerRequest[]
  ) {
    const idx = rowsDataEntry.findIndex(
      (item) => item.entity_id_relation === row.entity_id_relation
    )

    if (idx !== -1) {
      for (const id of row.activity_ids) {
        if (rowsDataEntry[idx]!.activity_ids.includes(id)) {
          c.addError(
            rowIdx,
            "validator.duplicate_activity_customer",
            String(id)
          )
        } else {
          rowsDataEntry[idx]!.activity_ids.push(id)
        }
      }
    } else {
      rowsDataEntry.push(row)
    }
  }

  #validateCustomerRelation(
    c: Context,
    listEntity: MasterData[],
    listEntityCustomer: EntityCustomerDTO[],
    listEntityActivities: EntityActivitiesDTO[],
    row: UpdateImportEntityCustomerRequest,
    rowIdx: string
  ) {
    const existCustomerRelation = listEntity.some(
      (item) => item.id === row.entity_id_relation
    )

    if (!existCustomerRelation) {
      const existCustomer = listEntityCustomer.some(
        (item) => item.customer_id === row.entity_id_relation
      )
      if (existCustomer) {
        const existActivity = listEntityActivities.some(
          (item) =>
            item.activity_id &&
            row.activity_ids.includes(item.activity_id) &&
            row.entity_id_relation === item.customer_id
        )
        if (existActivity) {
          c.addError(rowIdx, "validator.existing_entity_customer")
        }
      } else {
        c.addError(rowIdx, "validator.invalid_relation_customer")
      }
    }
  }

  validateAddCustomer = createMiddleware(async (c, next) => {
    const body = CreateEntityCustomerRequestSchema.parse(await c.req.json())
    const { add, entity_id } = body
    const listEntityID: number[] = []
    let listActivityID: number[] = []

    listEntityID.push(entity_id)
    add.forEach((item) => {
      listEntityID.push(item.entity_id_relation)
      listActivityID = listActivityID.concat(item.activity_ids)
    })

    const uniqListActivityID = [...new Set(listActivityID)]
    const uniqListEntityID = [...new Set(listEntityID)]
    await Promise.all([
      this.#validateEntityID(c, uniqListEntityID),
      this.#validateActivityID(c, uniqListActivityID),
    ])

    await next()
  })

  validateUpdateCustomer = createMiddleware(async (c, next) => {
    const body = UpdateEntityCustomerRequestSchema.parse(await c.req.json())
    const { entity_id, entity_id_relation, activity_ids } = body
    const listEntityID = [entity_id, entity_id_relation]

    const uniqListActivityID = [...new Set(activity_ids)]
    const uniqListEntityID = [...new Set(listEntityID)]
    await Promise.all([
      this.#validateEntityID(c, uniqListEntityID),
      this.#validateActivityID(c, uniqListActivityID),
    ])

    await next()
  })

  validateDeleteCustomer = createMiddleware(async (c, next) => {
    const body = DeleteEntityCustomerRequestSchema.parse(await c.req.json())
    const { entity_id, entity_ids_relation } = body
    entity_ids_relation.push(entity_id)
    const uniqListEntityID = [...new Set(entity_ids_relation)]
    await this.#validateEntityID(c, uniqListEntityID)

    await next()
  })

  validateImportEntityCustomer = async (
    c: Context,
    rows: ImportEntityCustomerRequest,
    template: BaseTemplate
  ) => {
    const startRow = template.getStartRow()
    const { id } = c.req.param()

    const [entityDetail, listCustomer] = await Promise.all([
      this.entityCustomerRepo.getEntityDetail(c, Number(id), c.var.programId),
      this.entityCustomerRepo.getListEntityCustomers(
        c,
        Number(id),
        c.get("programId")
      ),
    ])

    if (!entityDetail) {
      throw new ValidationError("ENTITY NOT FOUND")
    }

    const mapIDListCustomer = listCustomer
      .map((item) => item.customer_id)
      .filter((id) => id)
    const listEntityRelation = rows.map((item) => item.entity_id_relation)

    const [listEntity, listEntityActivities, listEntityCustomer] =
      await Promise.all([
        this.entityCustomerRepo.getValidateListEntityCustomerRelation(
          c,
          entityDetail,
          mapIDListCustomer,
          c.var.programId
        ),
        this.entityCustomerRepo.getValidateListEntityActivities(
          c,
          Number(id),
          c.get("programId")
        ),
        this.entityCustomerRepo.getEntityCustomer(
          c,
          Number(id),
          listEntityRelation,
          c.get("programId")
        ),
      ])

    const rowsDataEntry = [] as ImportEntityCustomerRequest
    rows.forEach((row, index) => {
      const rowIdx = String(index + startRow)

      this.#validateDuplicateActivity(c, row, rowIdx, rowsDataEntry)
      this.#validateCustomerRelation(
        c,
        listEntity,
        listEntityCustomer,
        listEntityActivities,
        row,
        rowIdx
      )
    })

    if (c.var.errors) {
      throw new ValidationError()
    }

    return rows
  }
}
