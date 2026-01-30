import { KFA_LEVEL_CODE_LIST } from "@/common/constants/material.js"
import { ValidationError } from "@smile-health/lib/error.js"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { MAP_ENTITY_TYPE_LABEL } from "@smile-health/lib/types/entity.js"
import { associate, collect } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { ActivityRepository } from "../activity/activity.repository.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { MaterialActivityRepository } from "../material-activity/material-activity.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { ProvinceRepository } from "../province/province.repository.js"
import { RegencyRepository } from "../regency/regency.repository.js"
import { SubDistrictRepository } from "../sub-district/sub-district.repository.js"
import { VillageRepository } from "../village/village.repository.js"
import { EntityMaterialRepository } from "./entity-material.repository.js"
import {
  ColumnImportSchema,
  CreateLogImportEntityMaterialDTO,
  generalMultipleIdSchema,
  GetTemplateEntityMaterialSchema,
  ImportEntityMaterialRequest,
  ImportEntityMaterialRequestSchema,
} from "./entity-material.schema.js"

export class EntityMaterialExcelMiddleware {
  constructor(
    private readonly repository: EntityMaterialRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly entityTagRepo: EntityTagRepository,
    private readonly provinceRepo: ProvinceRepository,
    private readonly regencyRepo: RegencyRepository,
    private readonly subdistrictRepo: SubDistrictRepository,
    private readonly villageRepo: VillageRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly entityRepo: EntityRepository,
    private readonly materialActivityRepo: MaterialActivityRepository
  ) {}

  readonly #isExist = (value, ctx) => {
    if (!value) {
      ctx.addIssue({
        message: "validator.not_exist",
        code: z.ZodIssueCode.custom,
      })
    }
  }

  template = (c: Context) => {
    return GetTemplateEntityMaterialSchema.extend({
      entity_type_id: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          if (val.length > 0) {
            const entityTypeIds = Object.keys(MAP_ENTITY_TYPE_LABEL)
            const isExist = val.every((item) => entityTypeIds.includes(item))
            this.#isExist(isExist, ctx)
          }
        })
        .optional(),
      entity_tag_id: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          if (val.length > 0) {
            const ids = val.map((id) => Number(id))
            const entitiTags = await this.entityTagRepo.findById(c, ids)
            const entitiTagIds = entitiTags.map((item) => item.id)
            const isExist = ids.every((item) => entitiTagIds.includes(item))
            this.#isExist(isExist, ctx)
          }
        })
        .transform((val) => val?.map((item) => Number(item)))
        .optional(),
      province_id: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          if (val.length > 0) {
            const data = await this.provinceRepo.findById(c, val)
            const dataIds = data.map((item) => item.id)
            const isExist = val.every((item) => dataIds.includes(Number(item)))
            this.#isExist(isExist, ctx)
          }
        })
        .optional(),
      regency_id: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          if (val.length > 0) {
            const data = await this.regencyRepo.findById(c, val)
            const dataIds = data.map((item) => item.id)
            const isExist = val.every((item) => dataIds.includes(Number(item)))
            this.#isExist(isExist, ctx)
          }
        })
        .optional(),
      subdistrict_id: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          if (val.length > 0) {
            const data = await this.subdistrictRepo.findById(c, val)
            const dataIds = data.map((item) => item.id)
            const isExist = val.every((item) => dataIds.includes(Number(item)))
            this.#isExist(isExist, ctx)
          }
        })
        .optional(),
      village_id: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          if (val.length > 0) {
            const data = await this.villageRepo.findById(c, val)
            const dataIds = data.map((item) => item.id)
            const isExist = val.every((item) => dataIds.includes(Number(item)))
            this.#isExist(isExist, ctx)
          }
        })
        .optional(),
      material_type: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          if (val.length > 0) {
            const ids = val.map((id) => Number(id))
            const data = await this.materialRepo.findMaterialTypes(c, ids)
            const dataIds = data.map((item) => item.id)
            const isExist = ids.every((item) => dataIds.includes(item))
            this.#isExist(isExist, ctx)
          }
        })
        .optional(),
      activity_id: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          if (val.length > 0) {
            const ids = val.map((id) => Number(id))
            const data = await this.activityRepo.findByIds(
              c,
              ids,
              c.get("programId")
            )
            const dataIds = data.map((item) => item.id)
            const isExist = ids.every((item) => dataIds.includes(item))
            this.#isExist(isExist, ctx)
          }
        })
        .optional(),
      material_level: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          if (val.length > 0) {
            const materialLevelIds = Object.keys(KFA_LEVEL_CODE_LIST)
            const isExist = val.every((item) => materialLevelIds.includes(item))
            this.#isExist(isExist, ctx)
          }
        })
        .optional(),
    })
  }

  readonly #getColumnTranslations = (c: Context): ColumnImportSchema => {
    return {
      EntityId: c.var.t("entity_material.label.entity_id"),
      MaterialActivityId: c.var.t("entity_material.label.material_activity_id"),
      Min: c.var.t("entity_material.label.min"),
      Max: c.var.t("entity_material.label.max"),
      ConsumptionRate: c.var.t("entity_material.label.consumption_rate"),
      RetailerPrice: c.var.t("entity_material.label.retailer_price"),
      Tax: c.var.t("entity_material.label.tax"),
    }
  }

  import = (c: Context) => {
    const COL: ColumnImportSchema = this.#getColumnTranslations(c)

    return ImportEntityMaterialRequestSchema(COL)
  }

  readonly #fetchDataFromDb = async (
    c: Context,
    entitySet: Set<number>,
    materialActivitySet: Set<number>
  ) => {
    return await Promise.all([
      entitySet.size > 0
        ? this.entityRepo.findByIds(c, Array.from(entitySet))
        : [],
      materialActivitySet.size > 0
        ? this.materialActivityRepo.findByIds(
            c,
            Array.from(materialActivitySet),
            c.get("programId")
          )
        : [],
    ])
  }

  readonly #collectAndAssociate = (dataEntities, dataMaterialActivities) => {
    return {
      entitieIds: dataEntities.length > 0 ? collect(dataEntities, "id") : [],
      materialActivitieIds:
        dataMaterialActivities.length > 0
          ? collect(dataMaterialActivities, "id")
          : [],
      materialActivityAssociate:
        dataMaterialActivities.length > 0
          ? associate(dataMaterialActivities, "id")
          : {},
    }
  }

  readonly #validateMinMax = (
    row: ImportEntityMaterialRequest,
    rowIdx: string,
    COL: ColumnImportSchema,
    c: Context
  ) => {
    if (row?.min !== undefined && row?.max !== undefined && row.min > row.max) {
      c.addError(
        rowIdx,
        c.var.t("validator.greater_than", {
          field1: COL.Max,
          field2: COL.Min,
        }),
        COL.Max
      )
    }
  }

  validateImport = async (
    c: Context,
    rows: ImportEntityMaterialRequest[],
    template: BaseTemplate
  ) => {
    if (rows.length > 4000) {
      c.addError(
        "rows",
        c.var.t("validator.lesser_or_equal", { field1: "Rows", field2: 4000 }),
        "rows"
      )
      throw new ValidationError(
        c.var.t("validator.lesser_or_equal", {
          field1: "Rows",
          field2: 4000,
        })
      )
    }
    // column with translation
    const COL: ColumnImportSchema = this.#getColumnTranslations(c)
    const startRow = template.getStartRow()
    const dataEntry: string[] = []
    const entitySet = new Set<number>()
    const materialActivitySet = new Set<number>()
    // get entity and material activity
    rows.forEach((item) => {
      entitySet.add(item.entityId)
      materialActivitySet.add(item.materialActivityId)
    })
    // get data entity and material activity from db
    const [dataEntities, dataMaterialActivities] = await this.#fetchDataFromDb(
      c,
      entitySet,
      materialActivitySet
    )
    // map entity and material activity
    const { entitieIds, materialActivitieIds, materialActivityAssociate } =
      this.#collectAndAssociate(dataEntities, dataMaterialActivities)
    // validate object rows data
    rows.forEach((row, index) => {
      const rowIdx = String(index + startRow)
      // validate duplicate data insert
      if (dataEntry.includes(`${row.entityId}-${row.materialActivityId}`)) {
        c.addError(
          rowIdx,
          "validator.duplicated",
          `${COL.EntityId} & ${COL.MaterialActivityId}`
        )
      } else {
        dataEntry.push(`${row.entityId}-${row.materialActivityId}`)
      }
      // validate id exist in db
      if (!entitieIds.includes(row.entityId)) {
        c.addError(rowIdx, "validator.not_exist", COL.EntityId)
      }
      if (!materialActivitieIds.includes(row.materialActivityId)) {
        c.addError(rowIdx, "validator.not_exist", COL.MaterialActivityId)
      } else {
        row.activityId =
          materialActivityAssociate[row.materialActivityId]?.activity_id ?? 0
        row.materialId =
          materialActivityAssociate[row.materialActivityId]?.material_id ?? 0
      }

      // validate min > max
      this.#validateMinMax(row, rowIdx, COL, c)
    })

    if (c.var.errors) {
      throw new ValidationError()
    }
    return rows
  }

  logErrors = createMiddleware(async (c, next) => {
    await next()
    if (c.var.errors) {
      const userID = c.var.userId
      const programId = c.var.programId
      const notes = c.var.errors
      const data: CreateLogImportEntityMaterialDTO = {
        program_id: programId,
        file: c.var.fileRequest.filename ?? "template.xlsx",
        status: 0,
        notes: JSON.stringify(notes),
        created_at: new Date(), // add this line
        created_by: userID!,
        updated_at: new Date(), // add this line
        updated_by: userID!,
        deleted_at: null, // add this line
        deleted_by: null, // add this line
      }

      await this.repository.createLogImportEntityMaterial(null, data)
    }
  })
}
