import { ValidationError } from "@smile-health/lib/error.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { MasterData } from "@smile-health/lib/types/param.js"
import { Context } from "hono"
import moment from "moment"
import path from "path"
import { EntityCustomerTemplate } from "./entity-customer.excel.js"
import { EntityCustomerPublisher } from "./entity-customer.publisher.js"
import { EntityCustomerRepository } from "./entity-customer.repository.js"
import {
  CreateEntityCustomerRequest,
  CustomerHasActivitiesDTO,
  CustomerVendorsDTO,
  DeleteEntityCustomerRequest,
  GetEntitiesCustomersQueries,
  GetEntitiesCustomersRelationQueries,
  ImportEntityCustomerDTO,
  ImportEntityCustomerRequest,
  UpdateEntityCustomerRequest,
} from "./entity-customer.schema.js"

export class EntityCustomerModule {
  constructor(
    private readonly entityCustomerRepo: EntityCustomerRepository,
    private readonly publisher: EntityCustomerPublisher
  ) {}

  async #generateActivityData(
    c: Context,
    entityID: number,
    listActivity: ImportEntityCustomerDTO[]
  ) {
    const listData: CustomerHasActivitiesDTO[] = []
    for (const item of listActivity) {
      if (item.activity_ids.length > 0) {
        const listEntityActivities =
          await this.entityCustomerRepo.getListEntityActivity(
            c,
            entityID,
            item.entity_id_relation,
            c.get("programId")
          )

        for (const id of item.activity_ids) {
          const isExistActivity = listEntityActivities.some(
            (val) => id === val.activity_id
          )
          const customerVendorId = listEntityActivities.find(
            (val) =>
              entityID === val.vendor_id &&
              item.entity_id_relation === val.customer_id &&
              c.var.programId === val.program_id
          )

          if (!isExistActivity && customerVendorId) {
            const object = {
              customer_vendor_id: customerVendorId.id,
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
          listEntity,
          c.get("programId")
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
            program_id: c.get("programId"),
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

  readonly #getTranslation = (
    c: Context,
    key: string,
    column: string | null
  ) => {
    if (!column) return null
    const result = c.var.t(`${key}.${column}`)
    return result.includes(".label.") ? key : result
  }

  async #generateWorksheetCustomerEntity(
    c: Context,
    excelTemplate: EntityCustomerTemplate,
    listEntity: AsyncIterableIterator<
      MasterData & { is_vendor: number | null; entity_tag_name: string | null }
    >
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
        this.#getTranslation(c, "entity_tag.label", item.entity_tag_name),
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

  async #deleteActivities(
    c: Context,
    listCustomerVendorID: number[],
    listActivityID: number[]
  ) {
    if (listCustomerVendorID.length > 0)
      await this.entityCustomerRepo.deleteActivities(
        c,
        listCustomerVendorID,
        listActivityID
      )
  }

  async #checkActiveOrder(
    c: Context,
    entityID: number,
    entityIDRelation: number[]
  ) {
    const { activityIds } = c.var
    const listActiveOrder = await this.entityCustomerRepo.checkActiveOrder(
      c,
      entityID,
      entityIDRelation,
      activityIds
    )

    if (listActiveOrder.length > 0) {
      throw new ValidationError("SOME ENTITY HAS ACTIVE ORDER")
    }
  }

  async list(c: Context, params: GetEntitiesCustomersQueries, id: number) {
    const { list, total } = await this.entityCustomerRepo.getListEntityCustomer(
      c,
      id,
      params,
      c.get("programId")
    )

    const parsedListEntity = list.map((entity) => {
      return {
        id: `${entity.customer_id}`,
        name: entity.name ?? "-",
        address: entity.address ?? "-",
        location: entity.location ?? "-",
        is_open_vial: entity.is_open_vial,
        activity: entity.activity.filter((item: { id: number }) => item.id), // Remove null response in array
      }
    })

    return new PaginatedResponse(params, parsedListEntity, total)
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

  async export(c: Context, params: GetEntitiesCustomersQueries, id: number) {
    const { is_consumption } = params
    const entityDetail = await this.entityCustomerRepo.getEntityDetail(
      c,
      id,
      c.get("programId")
    )
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
      params,
      c.get("programId")
    )

    // Consturct rows excel
    let count = 1
    const rows: (string | number | Date)[][] = []
    for await (const item of stream) {
      const row = [
        count,
        item.name ?? "-",
        item.activity ?? "-",
        item.updated_at
          ? moment(item.updated_at).locale(c.var.language).format("DD MMM YYYY")
          : "-",
        item.full_user_name ?? "-",
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
          entityDetail.name ?? "-",
        ],
        [
          `${c.var.t("entity_customer.label.location")} :`,
          entityDetail.location ?? "-",
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
      this.entityCustomerRepo.getEntityDetail(c, id, c.get("programId")),
      this.entityCustomerRepo.getListEntityCustomers(c, id, c.get("programId")),
    ])
    const mapIDListCustomer = listCustomer
      .map((item) => item.customer_id)
      .filter((id) => id)

    if (!entityDetail) {
      throw new ValidationError("Entity not found")
    }

    mapIDListCustomer.push(id) // Add current entity to exclude relation entity
    const [listEntity, listActivity] = await Promise.all([
      this.entityCustomerRepo.getListEntityCustomerBaseOnLocationStreamData(
        c,
        entityDetail,
        mapIDListCustomer,
        c.var.programId
      ),
      this.entityCustomerRepo.getListActivityStreamData(
        c,
        id,
        c.get("programId")
      ),
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
      this.entityCustomerRepo.getEntityDetail(c, id, c.get("programId")),
      this.entityCustomerRepo.getListEntityCustomers(c, id, c.get("programId")),
    ])

    const mapIDListCustomer = listCustomer
      .map((item) => item.customer_id)
      .filter((id) => id)

    if (!entityDetail) {
      throw new ValidationError("Entity not found")
    }

    mapIDListCustomer.push(id) // Add current entity to exclude relation entity
    const { list, total } =
      await this.entityCustomerRepo.getListEntityCustomerBaseOnLocation(
        c,
        params,
        entityDetail,
        mapIDListCustomer,
        c.var.programId
      )

    return new PaginatedResponse(params, list, total)
  }

  async create(c: Context, params: CreateEntityCustomerRequest) {
    const { entity_id, add } = params
    const insertDataCustomer = await this.#generateCustomerData(c, params)

    if (insertDataCustomer.length === 0)
      throw new ValidationError("DATA CUSTOMER VENDOR ALREADY EXISTS")

    await this.#addCustomer(c, insertDataCustomer)

    const insertDataActivity = await this.#generateActivityData(
      c,
      entity_id,
      add
    )

    if (insertDataActivity.length === 0)
      throw new ValidationError(
        "DATA CUSTOMER VENDOR ACTIVITIES ALREADY EXISTS"
      )

    await this.#addActivities(c, insertDataActivity)

    await this.publisher.processUpdate(c, entity_id, params.is_consumption)

    return { message: "SUCCESSFULLY ADD CUSTOMER" }
  }

  async update(c: Context, params: UpdateEntityCustomerRequest) {
    const { entity_id, entity_id_relation, activity_ids } = params
    const customerVendor = await this.entityCustomerRepo.getOneCustomerVendor(
      c,
      entity_id,
      entity_id_relation,
      c.var.programId
    )

    if (customerVendor) {
      await this.#deleteActivities(c, [customerVendor.id], activity_ids)

      const existingIds = await this.entityCustomerRepo.getListEntityActivity(
        c,
        entity_id,
        entity_id_relation,
        c.get("programId")
      )

      const mapListExistingIds = existingIds.map((item) => item.activity_id)
      const listData: CustomerHasActivitiesDTO[] = []

      for (const id of activity_ids) {
        if (!mapListExistingIds.includes(id)) {
          const object = {
            customer_vendor_id: customerVendor.id,
            activity_id: id,
            created_at: new Date(),
            updated_at: new Date(),
          }

          listData.push(object)
        }
      }

      if (listData.length > 0)
        await this.entityCustomerRepo.insertActivities(c, listData)
      return { message: "SUCCESSFULLY UPDATE CUSTOMER" }
    }

    return { message: "NO CUSTOMER UPDATED" }
  }

  async delete(c: Context, params: DeleteEntityCustomerRequest) {
    const { entity_id, entity_ids_relation } = params
    const listCustomerVendor = await this.entityCustomerRepo.getEntityCustomer(
      c,
      entity_id,
      entity_ids_relation,
      c.var.programId
    )
    await this.#checkActiveOrder(c, entity_id, entity_ids_relation)

    const listCustomerVendorID = listCustomerVendor.map((item) => item.id)
    if (listCustomerVendorID.length > 0) {
      await Promise.all([
        this.#deleteActivities(c, listCustomerVendorID, []),
        this.entityCustomerRepo.deleteCustomerEntity(c, listCustomerVendorID),
      ])

      await this.publisher.processUpdate(c, entity_id)

      return { message: "SUCCESSFULLY DELETE CUSTOMER" }
    }

    return { message: "NO CUSTOMER DELETED" }
  }
}
