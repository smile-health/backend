import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import moment from "moment"
import path from "path"
import { ValidationError } from "@smile/lib/error.js"
import { EntityCustomerRepository } from "./entity-customer.repository.js"
import {
  GetEntitiesCustomersQueries,
  GetEntitiesCustomersRelationQueries,
  GetExcelFileEntitiesCustomerQueries,
  CreateEntityCustomerRequest,
  UpdateEntityCustomerRequest,
  ImportEntityCustomerRequest,
  CustomerHasActivitiesDTO,
  CustomerVendorsDTO,
  ImportEntityCustomerDTO,
  DeleteEntityCustomerRequest,
} from "./entity-customer.schema.js"
import { EntityCustomerTemplate } from "./entity-customer.excel.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { MasterData } from "@smile/lib/types/param.js"

export class EntityCustomerModule {
  constructor(private entityCustomerRepo: EntityCustomerRepository) {}
  async #generateActivityData(
    c: Context,
    entityID: number,
    listActivity: ImportEntityCustomerDTO[]
  ) {
    const listData: CustomerHasActivitiesDTO[] = []
    for await (const item of listActivity) {
      if (item.activity_ids.length > 0) {
        const listEntityActivities =
          await this.entityCustomerRepo.getEntityHasActivities(
            c,
            entityID,
            item.entity_id_relation,
            item.activity_ids
          )

        for (const id of item.activity_ids) {
          const isExistActivity = listEntityActivities.some(
            (val) => id === val.activity_id
          )

          if (!isExistActivity) {
            const object = {
              vendor_id: entityID,
              customer_id: item.entity_id_relation,
              activity_id: id,
              created_at: new Date(),
              updated_at: new Date(),
            }
            listData.push(object)
          }
        }
      }
    }

    return listData
  }

  async #generateCustomerData(c: Context, params: CreateEntityCustomerRequest) {
    const { entity_id, is_consumption, add } = params
    const listEntity = add.map((item) => item.entity_id_relation)

    const listData: CustomerVendorsDTO[] = []
    if (listEntity.length > 0) {
      const listEntityCustomer =
        await this.entityCustomerRepo.getEntityCustomer(
          c,
          entity_id,
          listEntity
        )

      for (const id of listEntity) {
        const isExistEntityCustomer = listEntityCustomer.some(
          (val) => id === val.customer_id
        )

        let isDistribution = 1
        let isConsumption = 0
        if (is_consumption === 1) {
          isDistribution = 0
          isConsumption = 1
        }

        if (!isExistEntityCustomer) {
          const object = {
            customer_id: id,
            vendor_id: entity_id,
            is_distribution: isDistribution,
            is_consumption: isConsumption,
            created_at: new Date(),
            updated_at: new Date(),
          }

          listData.push(object)
        }
      }
    }

    return listData
  }

  async #addActivities(c: Context, listData: CustomerHasActivitiesDTO[]) {
    if (listData.length > 0)
      await this.entityCustomerRepo.insertActivities(c, listData)
  }

  async #addCustomer(c: Context, listData: CustomerVendorsDTO[]) {
    if (listData.length > 0)
      await this.entityCustomerRepo.insertCustomer(c, listData)
  }

  async #generateWorksheetCustomerEntity(
    c: Context,
    excelTemplate: EntityCustomerTemplate,
    listEntity: AsyncIterableIterator<MasterData & { is_vendor: number }>
  ) {
    // Consturct rows excel
    const rows: (string | number | null)[][] = []
    for await (const item of listEntity) {
      const row = [
        item.id,
        item.name,
        item.is_vendor === 1
          ? c.var.t("common.yes").toUpperCase()
          : c.var.t("common.no").toUpperCase(),
      ]
      rows.push(row)
    }

    const sheet = c.var.t("entity_customer.header.customer_entity_list")
    await excelTemplate.setRows(sheet, rows)
  }

  async #generateWorksheetCustomerActivity(
    c: Context,
    excelTemplate: EntityCustomerTemplate,
    listActivity: AsyncIterableIterator<MasterData>
  ) {
    // Consturct rows excel
    const rows: (string | number | null)[][] = []
    for await (const item of listActivity) {
      const row = [item.id, item.name]
      rows.push(row)
    }

    const sheet = c.var.t("entity_customer.header.activity_list")
    await excelTemplate.setRows(sheet, rows)
  }

  async #createCustomerEntity(
    c: Context,
    listData: CreateEntityCustomerRequest
  ) {
    if (listData.add.length > 0) await this.create(c, listData)
  }

  async list(c: Context, params: GetEntitiesCustomersQueries, id: number) {
    const [listEntity, totalEntityCustomer] = await Promise.all([
      this.entityCustomerRepo.getListEntityCustomer(c, id, params),
      this.entityCustomerRepo.getTotalCountEntityCustomer(c, id, params),
    ])

    const parsedListEntity = listEntity.map((entity) => {
      return {
        id: `${entity.customer_id}`,
        name: entity.name || "-",
        address: entity.address || "-",
        location: entity.location || "-",
        activity: entity.activity.filter((item: { id: number }) => item.id), // Remove null response in array
      }
    })

    return new PaginatedResponse(params, parsedListEntity, totalEntityCustomer)
  }

  async import(c: Context, id: number, rows: ImportEntityCustomerRequest) {
    const listDataImport = rows.reduce((result, item) => {
      const index = result.findIndex(
        (val) => val.entity_id_relation === item.entity_id_relation
      )

      if (index !== -1) {
        const listActivitiesID = item.activity_ids.concat(
          result[index]!.activity_ids
        )
        const uniqListActivitiesID = [...new Set(listActivitiesID)]
        result[index]!.activity_ids = uniqListActivitiesID
      } else {
        result.push(item as ImportEntityCustomerDTO)
      }

      return result
    }, [] as ImportEntityCustomerDTO[])
    const listEntityID = listDataImport.map((item) => item.entity_id_relation)
    const listEntity = await this.entityCustomerRepo.getListEntity(
      c,
      listEntityID
    )

    const listImportDistribution: ImportEntityCustomerDTO[] = []
    const listImportConsumption: ImportEntityCustomerDTO[] = []
    listDataImport.forEach((item) => {
      for (const val of listEntity) {
        if (val.id === item.entity_id_relation && val.is_vendor === 0) {
          listImportConsumption.push(item)
          break
        } else if (val.id === item.entity_id_relation && val.is_vendor === 1) {
          listImportDistribution.push(item)
          break
        }
      }
    })

    const paramsDistribution = {
      entity_id: id,
      is_consumption: 0,
      add: listImportDistribution,
    }

    const paramsConsumption = {
      entity_id: id,
      is_consumption: 1,
      add: listImportConsumption,
    }

    await Promise.all([
      this.#createCustomerEntity(c, paramsDistribution),
      this.#createCustomerEntity(c, paramsConsumption),
    ])

    return { message: "SUCCESSFULLY IMPORT DATA" }
  }

  async export(
    c: Context,
    params: GetExcelFileEntitiesCustomerQueries,
    id: number
  ) {
    const { is_consumption } = params
    const entityDetail = await this.entityCustomerRepo.getEntityDetail(c, id)
    if (!entityDetail) {
      throw new ValidationError("Entity not found")
    }

    let sheet = c.var.t("entity_customer.header.distribution")
    let headerCustomer = c.var.t(
      "entity_customer.label.customer_distribution_name"
    )
    if (is_consumption === 1) {
      sheet = c.var.t("entity_customer.header.consumption")
      headerCustomer = c.var.t(
        "entity_customer.label.customer_consumption_name"
      )
    }

    // Get stream data
    const stream = await this.entityCustomerRepo.getEntitiesCustomerStreamData(
      c,
      id,
      params
    )

    // Consturct rows excel
    let count = 1
    const rows: (string | number | Date)[][] = []
    for await (const item of stream) {
      const row = [
        count,
        item.name || "-",
        item.activity || "-",
        item.updated_at
          ? moment(item.updated_at).locale(c.var.language).format("DD MMM YYYY")
          : "-",
        item.full_user_name || "-",
      ]
      rows.push(row)
      count++
    }

    // Consturct columns excel
    const columns = [
      { key: "no", header: "No.", width: 15 },
      { key: "name", header: headerCustomer, width: 50 },
      {
        key: "activity",
        header: c.var.t("entity_customer.label.activity"),
        width: 20,
      },
      {
        key: "last_update",
        header: c.var.t("entity_customer.label.last_update"),
        width: 25,
      },
      {
        key: "created_by",
        header: c.var.t("entity_customer.label.created_by"),
        width: 20,
      },
    ]

    // Create Excel File
    const excelTemplate = new EntityCustomerTemplate()
    await excelTemplate.initSheet(sheet)
    await excelTemplate.addRows(
      sheet,
      [
        [
          `${c.var.t("entity_customer.label.entity_name")} :`,
          entityDetail.name || "-",
        ],
        [
          `${c.var.t("entity_customer.label.location")} :`,
          entityDetail.location || "-",
        ],
      ],
      1,
      "A"
    )
    excelTemplate.setColumns(columns, "A4")
    await excelTemplate.addRows(sheet, rows, 5, "A")

    const model = c.var.t("entity_customer.label.customer_entity")
    return excelTemplate.generate(model)
  }

  async exportTemplate(c: Context, id: number) {
    const [entityDetail, listCustomer] = await Promise.all([
      this.entityCustomerRepo.getEntityDetail(c, id),
      this.entityCustomerRepo.getListEntityCustomers(c, id),
    ])
    const mapIDListCustomer = listCustomer
      .map((item) => item.customer_id)
      .filter((id) => id) as number[]

    if (!entityDetail) {
      throw new ValidationError("Entity not found")
    }

    const [listEntity, listActivity] = await Promise.all([
      this.entityCustomerRepo.getListEntityCustomerBaseOnLocationStreamData(
        c,
        entityDetail,
        mapIDListCustomer
      ),
      this.entityCustomerRepo.getListActivityStreamData(c),
    ])

    // Create Excel File
    const excelTemplate = new EntityCustomerTemplate(
      undefined,
      undefined,
      PROCESSOR.XLSXPOPULATE
    )
    const pathname = path.join(
      __dirname,
      `../../../public/templates/entity-customer/template_entity_customer_${c.var.language}.xlsx`
    )
    await excelTemplate.loadFromFile(pathname)

    await this.#generateWorksheetCustomerEntity(c, excelTemplate, listEntity)
    await this.#generateWorksheetCustomerActivity(
      c,
      excelTemplate,
      listActivity
    )

    const model = `${c.var.t("entity_customer.label.customer_entity")} Template`
    return excelTemplate.generate(model)
  }

  async listRelationCustomer(
    c: Context,
    params: GetEntitiesCustomersRelationQueries,
    id: number
  ) {
    const [entityDetail, listCustomer] = await Promise.all([
      this.entityCustomerRepo.getEntityDetail(c, id),
      this.entityCustomerRepo.getListEntityCustomers(c, id),
    ])
    const mapIDListCustomer = listCustomer
      .map((item) => item.customer_id)
      .filter((id) => id) as number[]

    if (!entityDetail) {
      throw new ValidationError("Entity not found")
    }

    const [listEntity, totalEntity] = await Promise.all([
      this.entityCustomerRepo.getListEntityCustomerBaseOnLocation(
        c,
        params,
        entityDetail,
        mapIDListCustomer
      ),
      this.entityCustomerRepo.getTotalCountEntityCustomerBaseOnLocation(
        c,
        params,
        entityDetail,
        mapIDListCustomer
      ),
    ])

    return new PaginatedResponse(params, listEntity, totalEntity)
  }

  async create(c: Context, params: CreateEntityCustomerRequest) {
    const { entity_id, add } = params

    const [insertDataActivity, inserDataCustomer] = await Promise.all([
      this.#generateActivityData(c, entity_id, add),
      this.#generateCustomerData(c, params),
    ])

    if (insertDataActivity.length == 0 && inserDataCustomer.length === 0) {
      throw new ValidationError("DATA ALREADY EXISTS")
    }

    await Promise.all([
      this.#addActivities(c, insertDataActivity),
      this.#addCustomer(c, inserDataCustomer),
    ])

    return { message: "SUCCESSFULLY ADD CUSTOMER" }
  }

  async update(c: Context, params: UpdateEntityCustomerRequest) {
    const { entity_id, entity_id_relation, activity_ids } = params
    await this.entityCustomerRepo.deleteActivities(
      c,
      entity_id,
      entity_id_relation,
      activity_ids
    )

    const existingIds = await this.entityCustomerRepo.getListEntityActivity(
      c,
      entity_id,
      entity_id_relation
    )

    const mapListExistingIds = existingIds.map((item) => item.activity_id)
    const listData: CustomerHasActivitiesDTO[] = []
    activity_ids.forEach((id) => {
      if (!mapListExistingIds.includes(id)) {
        const object = {
          vendor_id: entity_id,
          customer_id: entity_id_relation,
          activity_id: id,
          created_at: new Date(),
          updated_at: new Date(),
        }

        listData.push(object)
      }
    })

    if (listData.length > 0) {
      await this.entityCustomerRepo.insertActivities(c, listData)
    }

    return { message: "SUCCESSFULLY UPDATE CUSTOMER" }
  }

  async delete(c: Context, params: DeleteEntityCustomerRequest) {
    const { entity_id, entity_id_relation } = params
    await Promise.all([
      this.entityCustomerRepo.deleteActivities(
        c,
        entity_id,
        entity_id_relation,
        []
      ),
      this.entityCustomerRepo.deleteCustomerEntity(
        c,
        entity_id,
        entity_id_relation
      ),
    ])

    return { message: "SUCCESSFULLY DELETE CUSTOMER" }
  }
}
