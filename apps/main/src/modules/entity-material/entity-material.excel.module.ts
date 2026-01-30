import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { GetEntitiesQueries } from "../entity/entity.schema.js"
import { MaterialActivityRepository } from "../material-activity/material-activity.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { EntityMaterialTemplate } from "./entity-material.excel.js"
import { EntityMaterialRepository } from "./entity-material.repository.js"
import {
  CreateLogImportEntityMaterialDTO,
  Emma,
  GetImportEntityMaterialQueries,
  GetTemplateEntityMaterialQueries,
  ImportEntityMaterialRequest,
} from "./entity-material.schema.js"

export class EntityMaterialExcelModule {
  constructor(
    private readonly entityMaterialRepo: EntityMaterialRepository,
    private readonly materialActivityRepo: MaterialActivityRepository,
    private readonly userRepo: UserRepository
  ) {}

  async template(c: Context, query: GetTemplateEntityMaterialQueries) {
    const programId = c.var.programId
    const language = c.var.language
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled || false
    const title = language === "en" ? "Entity Material" : "Material Entitas"
    const filename = `entity_material_${language.toLowerCase()}.xlsx`
    function notExistCondition(data) {
      return data?.length ? data : []
    }
    const queryEntity: GetEntitiesQueries & { village_ids: string[] } = {
      page: 1,
      paginate: 1,
      offset: 1,
      keyword: query.entity_name,
      type_ids: notExistCondition(query.entity_type_id),
      entity_tag_ids: notExistCondition(query.entity_tag_id),
      province_ids: notExistCondition(query.province_id),
      regency_ids: notExistCondition(query.regency_id),
      sub_district_ids: notExistCondition(query.subdistrict_id),
      village_ids: notExistCondition(query.village_id),
    }
    const excelTemplate = new EntityMaterialTemplate()
    excelTemplate.setTitle(title)
    await excelTemplate.loadFile(filename)
    await Promise.all([
      excelTemplate.setEntities(
        this.entityMaterialRepo.getEntityStream(c, queryEntity, programId)
      ),
      excelTemplate.setMaterials(
        this.materialActivityRepo.getMasterMaterialHasActivityStream(
          c,
          Array.isArray(query.activity_id)
            ? query.activity_id.map((item) => Number(item))
            : [],
          Array.isArray(query.material_type)
            ? query.material_type.map((item) => Number(item))
            : [],
          c.get("programId"),
          query.material_name,
          isKFAEnabled
        )
      ),
    ])
    return await excelTemplate.generateTemplate()
  }

  readonly #defaultNumberNotExist = (value) => {
    return value ?? 0
  }

  #removeUndefined<T extends object>(obj: T): Partial<T> {
    const result: Partial<T> = {}

    ;(Object.keys(obj) as Array<keyof T>).forEach((key) => {
      const value = obj[key]
      if (value !== undefined) {
        ;(result[key] as typeof value) = value
      }
    })

    return result
  }

  readonly #importEMA = async (
    c: Context,
    rows: ImportEntityMaterialRequest[]
  ) => {
    const userID = c.var.userId
    const now = new Date() // Set current date once for both create and update operations
    const createByAt = {
      created_by: userID!,
      created_at: now,
      updated_by: userID!,
      updated_at: now,
      deleted_at: null,
    }
    const updateByAt = {
      updated_by: userID!,
      updated_at: now,
      deleted_at: null,
    }

    // Helper function for default value handling
    const getDefaultValue = (value: number | undefined) =>
      this.#defaultNumberNotExist(value)

    const promises = rows.map((row) => {
      return (async () => {
        // Return the promise from the async function
        const isCreated = !row?.emma?.id
        const entityData = {
          // ...DEFAULT_DATA_ENTITY_MATERIAL,
          min: getDefaultValue(row.min),
          max: getDefaultValue(row.max),
          tax: getDefaultValue(row.tax),
          consumption_rate: getDefaultValue(row.consumptionRate),
          retailer_price: getDefaultValue(row.retailerPrice),
          entity_id: row.entityId,
          material_id: row.materialId,
          activity_id: row.activityId,
        }

        if (isCreated) {
          await this.entityMaterialRepo.createEntityMaterial(c, {
            ...entityData,
            ...createByAt,
          })
        } else {
          // Update both EntityMaterial and EntityMaterialActivity
          await this.entityMaterialRepo.updateEntityMaterial(
            c,
            getDefaultValue(row?.emma?.id),
            this.#removeUndefined({
              min: getDefaultValue(row.min),
              max: getDefaultValue(row.max),
              tax: getDefaultValue(row.tax),
              consumption_rate: getDefaultValue(row.consumptionRate),
              retailer_price: getDefaultValue(row.retailerPrice),
              deleted_by: null,
              ...updateByAt,
            })
          )
        }
      })() // Ensure we invoke the async function immediately
    })

    // Wait for all operations to complete
    await Promise.all(promises)
  }

  async logImport(c: Context) {
    const userID = c.var.userId
    const programId = c.var.programId
    const data: CreateLogImportEntityMaterialDTO = {
      program_id: programId,
      file: c.var.fileRequest.filename ?? "template.xlsx",
      status: 1,
      notes: JSON.stringify({}),
      created_at: new Date(), // add this line
      created_by: userID!,
      updated_at: new Date(), // add this line
      updated_by: userID!,
      deleted_at: null, // add this line
      deleted_by: null, // add this line
    }
    await this.entityMaterialRepo.createLogImportEntityMaterial(c, data)
  }

  async import(c: Context, rows: ImportEntityMaterialRequest[]) {
    const emma = await Promise.all(
      rows.map(async (item) => {
        const [emmaData] = await Promise.all([
          this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
            c,
            c.get("programId"),
            item.entityId,
            item.materialId,
            item.activityId
          ) as unknown as Emma | undefined,
        ])
        return {
          ...item,
          emma: emmaData,
        }
      })
    )
    await this.#importEMA(c, emma)

    return emma.length
  }

  async list(c: Context, query: GetImportEntityMaterialQueries) {
    const programId = c.var.programId
    const { data, total } =
      await this.entityMaterialRepo.findLogImportEntityMaterialAll(
        c,
        query,
        programId
      )
    const userIds = data
      .map((res) => res.created_by)
      .filter((id) => id !== null)
    const mapUsers = await this.userRepo.getBasicDetailMapped(c, userIds)
    const list = data.map((res) => {
      let noteObj: string | null = null
      if (typeof res.notes === "string") {
        const cleanedString = JSON.parse(`"${res.notes}"`)
        noteObj = JSON.parse(cleanedString)
      }
      if (typeof res.notes === "object" && Object.keys(res.notes).length)
        noteObj = res.notes
      return {
        ...res,
        notes: noteObj,
        user_created_by: mapUsers[res.created_by ?? 0],
      }
    })

    return new PaginatedResponse(query, list, total)
  }
}
