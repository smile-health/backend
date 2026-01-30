import {
  getTranslateMaterialColumnsExcel,
  MATERIAL_LEVEL,
} from "@/common/constants/material.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { OptionalIdsSchema } from "@smile-health/lib/types/param.js"
import {
  collect,
  transformStringNumbersToArrayNumbers,
} from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { ReferenceExpression, sql } from "kysely"
import { isStringObject } from "util/types"
import { z, ZodSchema } from "zod"
import { MaterialLevelRepository } from "../material-level/material-level.repository.js"
import { MaterialTypeRepository } from "../material-type/material-type.repository.js"
import { MaterialUnitRepository } from "../material-unit/material-unit.repository.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { WorkspaceDTO } from "../workspace/workspace.schema.js"
import { MaterialTemplate } from "./material.excel.js"
import { MaterialRepository } from "./material.repository.js"
import {
  arrayNumber,
  arrayString,
  CreateMaterialRequest,
  CreateMaterialRequestSchema,
  MaterialSchema,
  UpdateMaterialRequest,
  UpdateMaterialRequestSchema,
} from "./material.schema.js"
import { MaterialSubtypeRepository } from "../material-subtype/material-subtype.repository.js"

export class MaterialMiddleware {
  constructor(
    private readonly repo: MaterialRepository,
    private readonly materialLevelRepo: MaterialLevelRepository,
    private readonly materialTypeRepo: MaterialTypeRepository,
    private readonly materialUnitRepo: MaterialUnitRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly materialSubtypeRepo: MaterialSubtypeRepository
  ) {}

  createSchema = (c: Context) => {
    return this.attachCommonRefinements(c, CreateMaterialRequestSchema)
  }

  updateSchema = (c: Context) => {
    return this.attachCommonRefinements(c, UpdateMaterialRequestSchema)
  }

  importSchema = (c: Context) => {
    const EXCEL_COLUMNS = getTranslateMaterialColumnsExcel(c)
    const ImportMaterialRowSchema = z.object({
      [EXCEL_COLUMNS.name]: MaterialSchema.shape.name,
      [EXCEL_COLUMNS.description]: MaterialSchema.shape.description,
      [EXCEL_COLUMNS.code]: MaterialSchema.shape.code,
      [EXCEL_COLUMNS.hierarchy_code]: MaterialSchema.shape.hierarchy_code,
      [EXCEL_COLUMNS.material_parent_codes]:
        OptionalIdsSchema.nullish().or(arrayString),
      [EXCEL_COLUMNS.unit_of_consumption_id]:
        MaterialSchema.shape.unit_of_consumption_id,
      [EXCEL_COLUMNS.unit_of_distribution_id]:
        MaterialSchema.shape.unit_of_distribution_id,
      [EXCEL_COLUMNS.consumption_unit_per_distribution_unit]:
        MaterialSchema.shape.consumption_unit_per_distribution_unit,
      [EXCEL_COLUMNS.is_temperature_sensitive]: z.union(
        [z.literal(0), z.literal(1)],
        {
          errorMap: () => ({ message: "validator.only_0_or_1" }),
        }
      ),
      [EXCEL_COLUMNS.min_temperature]: MaterialSchema.shape.min_temperature,
      [EXCEL_COLUMNS.max_temperature]: MaterialSchema.shape.max_temperature,
      [EXCEL_COLUMNS.material_type_id]: MaterialSchema.shape.material_type_id,
      [EXCEL_COLUMNS.material_subtype_id]:
        MaterialSchema.shape.material_subtype_id,
      [EXCEL_COLUMNS.program_ids]: OptionalIdsSchema.nullish().or(arrayNumber),
      [EXCEL_COLUMNS.is_managed_in_batch]: z.union(
        [z.literal(0), z.literal(1)],
        {
          errorMap: () => ({ message: "validator.only_0_or_1" }),
        }
      ),
      [EXCEL_COLUMNS.min_retail_price]: MaterialSchema.shape.min_retail_price,
      [EXCEL_COLUMNS.max_retail_price]: MaterialSchema.shape.max_retail_price,
      [EXCEL_COLUMNS.is_stock_opname_mandatory]: z
        .union([z.literal(0), z.literal(1)], {
          errorMap: () => ({ message: "validator.only_0_or_1" }),
        })
        .default(0)
        .optional(),
    })

    const transformedMaterialRowSchema = ImportMaterialRowSchema.transform(
      async (row) => {
        const { is_hierarchy, material_level_id } = await c.req.parseBody()
        const programIds = transformStringNumbersToArrayNumbers(
          String(row[EXCEL_COLUMNS.program_ids])
        )

        let isHierarchy = false
        if (is_hierarchy || row[EXCEL_COLUMNS.hierarchy_code]) {
          isHierarchy = true
        }

        const transformedRow: CreateMaterialRequest = {
          name: String(row[EXCEL_COLUMNS.name]),
          description:
            row[EXCEL_COLUMNS.description] != null
              ? String(row[EXCEL_COLUMNS.description])
              : null,
          code: String(row[EXCEL_COLUMNS.code]),
          unit_of_consumption_id: Number(
            row[EXCEL_COLUMNS.unit_of_consumption_id]
          ),
          unit_of_distribution_id: Number(
            row[EXCEL_COLUMNS.unit_of_distribution_id]
          ),
          consumption_unit_per_distribution_unit: Number(
            row[EXCEL_COLUMNS.consumption_unit_per_distribution_unit]
          ),
          is_temperature_sensitive: Number(
            row[EXCEL_COLUMNS.is_temperature_sensitive]
          ),
          min_temperature: Number(row[EXCEL_COLUMNS.min_temperature]),
          max_temperature: Number(row[EXCEL_COLUMNS.max_temperature]),
          material_type_id: Number(row[EXCEL_COLUMNS.material_type_id]),
          program_ids: programIds,
          is_managed_in_batch: Number(row[EXCEL_COLUMNS.is_managed_in_batch]),
          min_retail_price: Number(row[EXCEL_COLUMNS.min_retail_price]),
          max_retail_price: Number(row[EXCEL_COLUMNS.max_retail_price]),
          is_stock_opname_mandatory: Number(
            row[EXCEL_COLUMNS.is_stock_opname_mandatory] || 0
          ),
          material_level_id: material_level_id ? Number(material_level_id) : 3,
          is_hierarchy: Number(isHierarchy),
        }

        const rawMaterialParentCodes = row[EXCEL_COLUMNS.material_parent_codes]
        if (rawMaterialParentCodes) {
          const materialParentCodes = isStringObject(rawMaterialParentCodes)
            ? rawMaterialParentCodes.split(/[\s;,|]+/).map((v) => v.trim())
            : rawMaterialParentCodes

          const columParent: ReferenceExpression<DB, "materials">[] = ["code"]

          if (row[EXCEL_COLUMNS.hierarchy_code]) {
            columParent.push("hierarchy_code")
          }

          const materialParentIds = collect(
            await this.repo.findDynamicMultiField(
              c,
              columParent,
              "in",
              materialParentCodes
            ),
            "id"
          )

          transformedRow.material_parent_ids = materialParentIds
          transformedRow.material_level_id = 2
        }

        if (row[EXCEL_COLUMNS.hierarchy_code]) {
          transformedRow.hierarchy_code = String(
            row[EXCEL_COLUMNS.hierarchy_code]
          )
        }

        if (row[EXCEL_COLUMNS.material_subtype_id]) {
          transformedRow.material_subtype_id = Number(
            row[EXCEL_COLUMNS.material_subtype_id]
          )
        }

        return transformedRow
      }
    )

    const refinedMaterialRowSchema = this.attachCommonRefinements(
      c,
      transformedMaterialRowSchema
    )

    return z
      .array(refinedMaterialRowSchema)
      .min(1, { message: "rows cannot be empty" })
  }

  importTemplate = async () => {
    const template = new MaterialTemplate()
    return template
  }

  attachCommonRefinements = (c: Context, schema: ZodSchema) => {
    return schema.superRefine(async (data, ctx) => {
      const { id } = c.req.param() // if update
      const materialId = id ? Number(id) : undefined

      await this.#isMaterialNotExistByField(
        c,
        ctx,
        "code",
        data.code,
        materialId
      )

      if (data.hierarchy_code) {
        await this.#isMaterialNotExistByField(
          c,
          ctx,
          "hierarchy_code",
          data.hierarchy_code,
          materialId
        )
      }

      await this.#isExistById(
        c,
        ctx,
        this.materialLevelRepo,
        "material_level_id",
        data.material_level_id
      )

      await this.#isExistById(
        c,
        ctx,
        this.materialTypeRepo,
        "material_type_id",
        data.material_type_id
      )

      await this.#isExistById(
        c,
        ctx,
        this.materialUnitRepo,
        "unit_of_consumption_id",
        data.unit_of_consumption_id
      )

      await this.#isExistById(
        c,
        ctx,
        this.materialUnitRepo,
        "unit_of_distribution_id",
        data.unit_of_distribution_id
      )

      if (data.material_subtype_id) {
        await this.#isExistById(
          c,
          ctx,
          this.materialSubtypeRepo,
          "material_subtype_id",
          data.material_subtype_id
        )

        await this.#validateMaterialSubtypeRelation(
          c,
          ctx,
          data.material_type_id,
          data.material_subtype_id
        )
      }

      if (data.material_parent_ids && data.material_parent_ids.length > 0) {
        await this.#isMaterialParentExistByIds(c, ctx, data)
        await this.#isMaterialParentValid(c, ctx, data)
      }

      if (data.program_ids && data.program_ids.length > 0) {
        await this.#isProgramExistById(c, ctx, data)
        await this.#isProgramValid(c, ctx, data)
      }

      this.#validateMinMax(
        c,
        ctx,
        data.min_retail_price,
        data.max_retail_price,
        "min_retail_price",
        "max_retail_price"
      )

      if (data.min_temperature && data.max_temperature) {
        this.#validateMinMax(
          c,
          ctx,
          data.min_temperature,
          data.max_temperature,
          "min_temperature",
          "max_temperature"
        )
      }

      this.#validateMaterialHierarchy(c, ctx, data)

      // validate only for update
      if (materialId) {
        await this.#validateMaterialInTransaction(c, ctx, materialId, data)
        await this.#validateMaterialInStockOpname(c, ctx, materialId, data)
      }
    })
  }

  readonly #isMaterialNotExistByField = async (
    c: Context,
    ctx: z.RefinementCtx,
    field: ReferenceExpression<DB, "materials">,
    value: string | number,
    id?: number
  ) => {
    const record = (await this.repo.findDynamic(c, field, "=", value))[0]

    if (record && record.id !== id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.exist",
        path: [typeof field === "string" ? field : JSON.stringify(field)],
      })
    }
  }

  readonly #isExistById = async (
    c: Context,
    ctx: z.RefinementCtx,
    repo,
    field: string,
    value: number
  ) => {
    const record = await repo.findById(c, value)
    if (!record) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
        path: [field],
      })
    }
  }

  readonly #isMaterialParentExistByIds = async (
    c: Context,
    ctx: z.RefinementCtx,
    { material_parent_ids }
  ) => {
    const fetchedMaterialParents = await this.repo.findDynamic(
      c,
      "id",
      "in",
      material_parent_ids
    )

    const collectedMaterialParentIds = collect(fetchedMaterialParents, "id")

    material_parent_ids.forEach((materialParentid: number) => {
      if (!collectedMaterialParentIds.includes(materialParentid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: c.var.t("validator.not_exist", {
            field: `${c.var.t("material.label.parent_material")} id ${materialParentid}`,
          }),
          path: ["material_parent_ids"],
        })
      }
    })
  }

  readonly #isMaterialParentValid = async (
    c: Context,
    ctx: z.RefinementCtx,
    { material_parent_ids }
  ) => {
    const { material_level_id } = await c.req.parseBody()

    const materialLevels =
      await this.materialLevelRepo.findAllWithoutPaginate(c)

    const targetLevel = materialLevels.data.find(
      (level) => level.id === Number(material_level_id)
    )

    const parentMaterials = await this.repo.findDynamic(
      c,
      "id",
      "in",
      material_parent_ids
    )

    for (const parent of parentMaterials) {
      const parentLevel = materialLevels.data.find(
        (level) => level.id === parent.material_level_id
      )

      if (
        parentLevel &&
        targetLevel &&
        parentLevel.order >= targetLevel.order
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: c.var.t("validator.invalid_material_parent", {
            field: parent.id,
          }),
          path: ["material_parent_ids"],
        })
      }
    }
  }

  readonly #isProgramExistById = async (
    c: Context,
    ctx: z.RefinementCtx,
    { program_ids }
  ) => {
    const fetchedPrograms: WorkspaceDTO[] =
      await this.workspaceRepo.findAllDynamic(c, "id", "in", program_ids)

    const collectedProgramIds = collect(fetchedPrograms, "id")

    program_ids.forEach((programId: number) => {
      if (!collectedProgramIds.includes(programId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: c.var.t("validator.not_exist", {
            field: `Program id ${programId}`,
          }),
          path: ["program_ids"],
        })
      }
    })
  }

  readonly #isProgramValid = async (
    c: Context,
    ctx: z.RefinementCtx,
    { is_hierarchy, program_ids }
  ) => {
    const isHierarchy = !!is_hierarchy
    const programsWithInvertedHierarchy = collect(
      await this.workspaceRepo.findAllDynamic(
        c,
        sql<boolean>`JSON_EXTRACT(config, '$.material.is_hierarchy_enabled')`,
        "=",
        !isHierarchy
      ),
      "id"
    )

    program_ids.forEach((programId: number) => {
      if (programsWithInvertedHierarchy.includes(programId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: c.var.t("validator.invalid_program", {
            field: programId,
          }),
          path: ["program_ids"],
        })
      }
    })
  }

  readonly #validateMaterialHierarchy = (
    c: Context,
    ctx: z.RefinementCtx,
    { is_hierarchy, hierarchy_code, material_parent_ids, material_level_id }
  ) => {
    if (!is_hierarchy && material_level_id !== MATERIAL_LEVEL.VARIANT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.non_hierarchy_material_level"),
        path: ["material_level_id"],
      })
    }

    if (!is_hierarchy && hierarchy_code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.non_hierarchy_material_cannot_set_field", {
          field1: `${c.var.t("material_level.label.template")} ${c.var.t("common.and")} ${c.var.t("material_level.label.variant")}`,
          field2: "hierarchy_code",
        }),
        path: ["hierarchy_code"],
      })
    }

    if (!is_hierarchy && material_parent_ids) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.non_hierarchy_material_cannot_set_field", {
          field1: `${c.var.t("material_level.label.template")} ${c.var.t("common.and")} ${c.var.t("material_level.label.variant")}`,
          field2: "material_parent_ids",
        }),
        path: ["material_parent_ids"],
      })
    }

    if (
      is_hierarchy &&
      material_level_id !== MATERIAL_LEVEL.TEMPLATE &&
      is_hierarchy &&
      material_level_id !== MATERIAL_LEVEL.VARIANT
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.hierarchy_material_level"),
        path: ["material_level_id"],
      })
    }

    if (is_hierarchy && !hierarchy_code) {
      console.log(1)

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.hierarchy_material_need_to_set_field", {
          field1: `${c.var.t("material_level.label.template")} ${c.var.t("common.and")} ${c.var.t("material_level.label.variant")}`,
          field2: "hierarchy_code",
        }),
        path: ["hierarchy_code"],
      })
    }

    if (
      is_hierarchy &&
      material_level_id === MATERIAL_LEVEL.VARIANT &&
      (!material_parent_ids || material_parent_ids.length === 0)
    ) {
      console.log(2)

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.hierarchy_material_need_to_set_field", {
          field1: c.var.t("material_level.label.variant"),
          field2: "material_parent_ids",
        }),
        path: ["material_parent_ids"],
      })
    }

    if (
      is_hierarchy &&
      material_level_id === MATERIAL_LEVEL.TEMPLATE &&
      material_parent_ids
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.non_hierarchy_material_cannot_set_field", {
          field1: c.var.t("material_level.label.template"),
          field2: "material_parent_ids",
        }),
        path: ["material_parent_ids"],
      })
    }
  }

  // validate that if material is in transaction, consumption_unit_per_distribution_unit should not change
  readonly #validateMaterialInTransaction = async (
    c: Context,
    ctx: z.RefinementCtx,
    id: number,
    data: UpdateMaterialRequest
  ) => {
    const material = await this.repo.findInTransaction(c, id)
    if (!material) {
      return
    }

    const restrictedFields = [
      "consumption_unit_per_distribution_unit",
      "is_managed_in_batch",
      "is_temperature_sensitive",
    ]

    for (const field of restrictedFields) {
      if (material[field] !== data[field]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "validator.update_has_transaction",
          path: [field],
        })
      }
    }
  }

  readonly #validateMinMax = (
    c: Context,
    ctx: z.RefinementCtx,
    min: number,
    max: number,
    minField: string,
    maxField: string
  ) => {
    if (min > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.not_greater_than", {
          field1: minField,
          field2: maxField,
        }),
        path: [minField],
      })
    }

    if (max < min) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t("validator.not_less_than", {
          field1: maxField,
          field2: minField,
        }),
        path: [maxField],
      })
    }
  }

  // validate that if material is in stock opname, is_stock_opname_mandatory should not change
  readonly #validateMaterialInStockOpname = async (
    c: Context,
    ctx: z.RefinementCtx,
    id: number,
    data: UpdateMaterialRequest
  ) => {
    const material = await this.repo.findInStockOpname(c, id)

    if (
      !material ||
      material.is_stock_opname_mandatory === data.is_stock_opname_mandatory
    ) {
      return
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "validator.update_has_stock_opname",
      path: ["is_stock_opname_mandatory"],
    })
  }

  readonly #validateMaterialSubtypeRelation = async (
    c: Context,
    ctx: z.RefinementCtx,
    materialTypeId: number,
    materialSubtypeId: number
  ) => {
    const res = await this.materialSubtypeRepo.findOne(c, {
      id: materialSubtypeId,
      material_type_id: materialTypeId,
    })

    if (!res) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "validator.material_subtype_not_related",
        path: ["material_subtype_id"],
      })
    }
  }
}
