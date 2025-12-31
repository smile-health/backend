import { Context } from "hono"
import { EntityMaterialRepository } from "./entity-material.repository.js"
import {
  CreateLogImportEntityMaterialDTO,
  Ehmm,
  Emma,
  GetImportEntityMaterialQueries,
  GetTemplateEntityMaterialQueries,
  ImportEntityMaterialRequest,
} from "./entity-material.schema.js"
import { GetEntitiesQueries } from "../entity/entity.schema.js"
import { EntityMaterialTemplate } from "./entity-material.excel.js"
import { MaterialActivityRepository } from "../material-activity/material-activity.repository.js"
import { DEFAULT_DATA_ENTITY_MATERIAL } from "@/common/constants/entity-material.js"
import { group } from "@smile/lib/utils.js"
import { UserRepository } from "../user/user.repository.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"

export class EntityMaterialExcelModule {
  constructor(
    private entityMaterialRepo: EntityMaterialRepository,
    private materialActivityRepo: MaterialActivityRepository,
    private userRepo: UserRepository
  ) {}

  async template(c: Context, query: GetTemplateEntityMaterialQueries) {
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
        this.entityMaterialRepo.getEntityStream(c, queryEntity)
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
          query.material_name,
          isKFAEnabled
        )
      ),
    ])
    return await excelTemplate.generateTemplate()
  }

  #defaultNumberNotExist = (value) => {
    return value ? value : 0
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

  #importWithoutKfa = async (
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
        const isCreated = !row?.ehmm?.id
        const entityData = {
          ...DEFAULT_DATA_ENTITY_MATERIAL,
          min: getDefaultValue(row.min),
          max: getDefaultValue(row.max),
          entity_id: row.entityId,
          master_material_id: row.materialId,
        }

        if (isCreated) {
          const dataInsert = await this.entityMaterialRepo.createEntityMaterial(
            c,
            {
              ...entityData,
              ...createByAt,
            }
          )

          const ehmmInsertId = dataInsert[0]?.insertId
          await this.entityMaterialRepo.createEntityMaterialActivity(c, {
            entity_master_material_id: Number(ehmmInsertId),
            activity_id: row.activityId,
            consumption_rate: getDefaultValue(row.consumptionRate),
            retailer_price: getDefaultValue(row.retailerPrice),
            tax: getDefaultValue(row.tax),
            min: getDefaultValue(row.min),
            max: getDefaultValue(row.max),
            allocated: 0,
            stock_on_hand: 0,
            ...createByAt,
          })
        } else {
          let emmaId: number = getDefaultValue(row?.emma?.emma_id)

          // If emma object is missing, create the entity material activity
          if (!row?.emma) {
            const dataInsertEmma =
              await this.entityMaterialRepo.createEntityMaterialActivity(c, {
                entity_master_material_id: Number(row?.ehmm?.id),
                activity_id: row.activityId,
                consumption_rate: getDefaultValue(row.consumptionRate),
                retailer_price: getDefaultValue(row.retailerPrice),
                tax: getDefaultValue(row.tax),
                min: getDefaultValue(row.min),
                max: getDefaultValue(row.max),
                allocated: 0,
                stock_on_hand: 0,
                ...createByAt,
              })
            emmaId = Number(dataInsertEmma[0]?.insertId)
          }

          // Update both EntityMaterial and EntityMaterialActivity
          await Promise.all([
            this.entityMaterialRepo.updateEntityMaterial(
              c,
              getDefaultValue(row?.ehmm?.id),
              this.#removeUndefined({
                min: row.min,
                max: row.max,
                deleted_by: null,
                ...updateByAt,
              })
            ),
            this.entityMaterialRepo.updateEntityMaterialActivity(
              c,
              emmaId,
              this.#removeUndefined({
                consumption_rate: row.consumptionRate,
                retailer_price: row.retailerPrice,
                tax: row.tax,
                min: row.min,
                max: row.max,
                ...updateByAt,
              })
            ),
          ])
        }
      })() // Ensure we invoke the async function immediately
    })

    // Wait for all operations to complete
    await Promise.all(promises)
  }

  #importWithKfa = async (c: Context, rows: ImportEntityMaterialRequest[]) => {
    const [materialChildPromises] = await Promise.all([
      Promise.all(
        rows.map(async (row) =>
          this.entityMaterialRepo.getMaterialChild(
            c,
            [row.materialId],
            row.activityId
          )
        )
      ),
      this.#importWithoutKfa(c, rows),
    ])

    const materialChilds = materialChildPromises.flat()
    const materialChildGroup = group(materialChilds, "parent_id")
    const rowChilds: ImportEntityMaterialRequest[] = []

    const promises = rows.map((row) => {
      return (async () => {
        const materialChild = materialChildGroup[row.materialId] ?? []
        for (const child of materialChild) {
          const [ehmmData, emmaData] = await Promise.all([
            this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
              c,
              row.entityId,
              child.id,
              row.activityId,
              false
            ) as unknown as Ehmm | undefined,
            this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
              c,
              row.entityId,
              child.id,
              row.activityId,
              true
            ) as unknown as Emma | undefined,
          ])
          rowChilds.push({
            ...row,
            materialId: child.id,
            ehmm: ehmmData,
            emma: emmaData,
          })
          await this.#importWithoutKfa(c, rowChilds)
        }
      })() // Ensure we invoke the async function immediately
    })

    // Wait for all operations to complete
    await Promise.all(promises)
  }

  async logImport(c: Context) {
    const userID = c.var.userId
    const data: CreateLogImportEntityMaterialDTO = {
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
    const isKFAEnabled = c.var.config?.material.is_hierarchy_enabled || false
    const ehmm = await Promise.all(
      rows.map(async (item) => {
        const [ehmmData, emmaData] = await Promise.all([
          this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
            c,
            item.entityId,
            item.materialId,
            item.activityId,
            false
          ) as unknown as Ehmm | undefined,
          this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
            c,
            item.entityId,
            item.materialId,
            item.activityId,
            true
          ) as unknown as Emma | undefined,
        ])
        return {
          ...item,
          ehmm: ehmmData,
          emma: emmaData,
        }
      })
    )

    if (isKFAEnabled) {
      await this.#importWithKfa(c, ehmm)
    } else {
      await this.#importWithoutKfa(c, ehmm)
    }

    return ehmm.length
  }

  async list(c: Context, query: GetImportEntityMaterialQueries) {
    const { data, total } =
      await this.entityMaterialRepo.findLogImportEntityMaterialAll(c, query)
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
