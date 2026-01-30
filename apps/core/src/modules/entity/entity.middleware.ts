import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { LOCATION } from "@/common/constants/location.js"
import {
  ColumnImportSchema,
  CreateEntityRequest,
  EntityId,
  generalMultipleIdSchema,
  GetEntitiesParamsSchema,
  ImportEntityRequest,
  ImportEntityRequestSchema,
  ImportSets,
  TCreateEntityRequest,
} from "@/modules/entity/entity.schema.js"
import { zValidator } from "@hono/zod-validator"
import { ValidationError } from "@smile-health/lib/error.js"
import { collect } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { validator } from "hono/validator"
import { z } from "zod"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { EntityTypeRepository } from "../entity-type/entity-type.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { EntityContext } from "./entity.context.js"
import { EntityRepository } from "./entity.repository.js"

export class EntityMiddleware {
  constructor(
    private readonly entityRepo: EntityRepository,
    private readonly entityTagRepo: EntityTagRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly entityTypeRepo: EntityTypeRepository,
    private readonly locationRepo: LocationRepository
  ) {}

  entityIdValidation = zValidator(
    "param",
    EntityId,
    async (result, c: EntityContext) => {
      if (!result.success) {
        throw new ValidationError(result.error.issues[0]?.message)
      }
      const id = Number(result.data.id) || 0
      const entity = await this.entityRepo.findById(c, id, false)

      if (!id) {
        throw new ValidationError(
          c.var.t("validator.number", { field: "entity_id" })
        )
      }

      if (!entity) {
        throw new ValidationError(
          c.var.t("validator.not_exist", { field: "entity_id" })
        )
      }

      c.set("entity", entity)
    }
  )

  checkEntityRelation = async (
    c: EntityContext,
    data: TCreateEntityRequest
  ) => {
    const { t, entity } = c.var

    // skip validation if no change on entity type
    if (data.type !== entity.type) {
      const isRelationExist = await this.entityRepo.findInCustomerVendor(
        c,
        entity.id
      )
      if (isRelationExist) {
        throw new ValidationError(t("validator.entity_has_relation"))
      }
    }

    return data
  }

  public sanitizeEntityData() {
    return validator("json", async (value) => {
      const data = value as TCreateEntityRequest

      if (data.type === ENTITY_TYPE.PROVINCE) {
        data.regency_id = null
        data.sub_district_id = null
        data.village_id = null
      } else if (data.type === ENTITY_TYPE.CITY) {
        data.sub_district_id = null
        data.village_id = null
      }

      return data
    })
  }

  // -- new validate -- //
  readonly #fetchIfNotEmpty = <T>(
    set: Set<number | string>,
    fetchFn: Promise<T[]>
  ): Promise<T[]> => {
    return set.size > 0 ? fetchFn : Promise.resolve([])
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly #collectIfNotEmpty = <T extends Record<string, any>>(
    set: Set<number | string>,
    items: T[],
    key: string
  ): (number | string)[] => {
    return set.size > 0 ? collect(items, key) : []
  }

  // Helper function to add issues
  readonly #addIssue = (
    index: number,
    column: string,
    message: string,
    ctx: z.RefinementCtx
  ) => {
    ctx.addIssue({
      path: [index, column],
      code: "custom",
      message,
    })
  }

  // Helper function to validate IDs against a list
  readonly #validateId = (
    index: number,
    id: number | null | undefined,
    validIds: (string | number)[],
    column: string,
    ctx: z.RefinementCtx
  ) => {
    if (id && !validIds.includes(id)) {
      this.#addIssue(index, column, `validator.not_exist`, ctx)
    }
  }

  // Helper function to validate length
  readonly #validateLength = (
    c: Context,
    index: number,
    value: string | undefined,
    maxLength: number,
    column: string,
    ctx: z.RefinementCtx
  ) => {
    if (value && value.length > maxLength) {
      this.#addIssue(
        index,
        column,
        c.var.t("validator.max_length", {
          field: column,
          length: maxLength,
        }),
        ctx
      )
    }
  }

  // Collect sets of IDs for import validation
  readonly #importCollectSets = (rows: ImportEntityRequest[]) => {
    const sets = {
      codeSet: new Set<string>(),
      typeIdSet: new Set<number>(),
      entityTagSet: new Set<number>(),
      provinceSet: new Set<number>(),
      regencySet: new Set<number>(),
      subdistrictSet: new Set<number>(),
      villageSet: new Set<number>(),
      programSet: new Set<number>(),
      idSatuSehatSet: new Set<number>(),
    }

    rows.forEach((row) => {
      sets.codeSet.add(row.Code)
      sets.typeIdSet.add(row.TypeId)
      sets.entityTagSet.add(row.EntityTagId)
      sets.provinceSet.add(row.ProvinceId ?? 0)
      sets.regencySet.add(row.RegencyId ?? 0)
      sets.subdistrictSet.add(row.SubDistrictId ?? 0)
      sets.villageSet.add(row.VillageId ?? 0)
      row.ProgramId?.forEach((num) => sets.programSet.add(num))
      if (row.idSatuSehat !== undefined && row.idSatuSehat !== null) {
        sets.idSatuSehatSet.add(row.idSatuSehat)
      }
    })

    if (sets.programSet.size === 0) sets.programSet.add(0)

    return sets
  }

  import = (c: Context) => {
    const COL: ColumnImportSchema = {
      Name: c.var.t("entity.label.name"),
      Code: c.var.t("entity.label.code"),
      Address: c.var.t("entity.label.address"),
      TypeId: c.var.t("entity.label.id_type"),
      EntityTagId: c.var.t("entity.label.id_entity_tag"),
      ProvinceId: c.var.t("entity.label.id_province"),
      RegencyId: c.var.t("entity.label.id_regency"),
      SubDistrictId: c.var.t("entity.label.id_sub_district"),
      VillageId: c.var.t("entity.label.id_village"),
      ProgramId: c.var.t("entity.label.id_program"),
      PostalId: c.var.t("entity.label.postal_code"),
      Latitude: c.var.t("entity.label.latitude"),
      Longitude: c.var.t("entity.label.longitude"),
      Country: c.var.t("entity.label.country"),
      idSatuSehat: c.var.t("entity.label.msi_code"),
    }

    return ImportEntityRequestSchema(COL).superRefine(async (rows, ctx) => {
      // Fetch IDs from the database
      const fetchIds = async (sets: ImportSets) => {
        return await Promise.all([
          this.#fetchIfNotEmpty(
            sets.codeSet,
            this.entityRepo.findByCodes(c, Array.from(sets.codeSet))
          ),
          this.#fetchIfNotEmpty(
            sets.typeIdSet,
            this.entityTypeRepo.findByIds(c, Array.from(sets.typeIdSet))
          ),
          this.#fetchIfNotEmpty(
            sets.entityTagSet,
            this.entityTagRepo.findByIds(c, Array.from(sets.entityTagSet))
          ),
          this.#fetchIfNotEmpty(
            sets.provinceSet,
            this.locationRepo.findByIDs(
              c,
              Array.from(sets.provinceSet),
              LOCATION.PROVINCE
            )
          ),
          this.#fetchIfNotEmpty(
            sets.regencySet,
            this.locationRepo.findByIDs(
              c,
              Array.from(sets.regencySet),
              LOCATION.REGENCY
            )
          ),
          this.#fetchIfNotEmpty(
            sets.subdistrictSet,
            this.locationRepo.findByIDs(
              c,
              Array.from(sets.subdistrictSet),
              LOCATION.SUBDISTRICT
            )
          ),
          this.#fetchIfNotEmpty(
            sets.villageSet,
            this.locationRepo.findByIDs(
              c,
              Array.from(sets.villageSet),
              LOCATION.VILLAGE
            )
          ),
          this.#fetchIfNotEmpty(
            sets.programSet,
            this.workspaceRepo.findAllByIds(c, Array.from(sets.programSet))
          ),
          this.#fetchIfNotEmpty(
            sets.idSatuSehatSet,
            this.entityRepo.findByIdSatuSehat(
              c,
              Array.from(sets.idSatuSehatSet)
            )
          ),
        ])
      }

      // // Main validation logic
      const sets = this.#importCollectSets(rows)
      const dataFetch = await fetchIds(sets)
      const [
        codes,
        types,
        entityTags,
        provinces,
        regencies,
        subdistricts,
        villages,
        programs,
        idSatuSehat,
      ] = dataFetch

      const codeIds = this.#collectIfNotEmpty(sets.codeSet, codes, "code")
      const idSatuSehats = this.#collectIfNotEmpty(
        sets.idSatuSehatSet,
        idSatuSehat,
        "id_satu_sehat"
      )
      const typeIds = this.#collectIfNotEmpty(
        sets.typeIdSet,
        types as Record<string, any>[],
        "id"
      )
      const entityTagIds = this.#collectIfNotEmpty(
        sets.entityTagSet,
        entityTags as Record<string, any>[],
        "id"
      )
      const provinceIds = this.#collectIfNotEmpty(
        sets.provinceSet,
        provinces,
        "id"
      )
      const regencieIds = this.#collectIfNotEmpty(
        sets.regencySet,
        regencies,
        "id"
      )
      const subdistrictIds = this.#collectIfNotEmpty(
        sets.subdistrictSet,
        subdistricts,
        "id"
      )
      const villageIds = this.#collectIfNotEmpty(
        sets.villageSet,
        villages,
        "id"
      )
      const programIds = this.#collectIfNotEmpty(
        sets.programSet,
        programs,
        "id"
      )

      const codeExist: string[] = []
      const idSatuSehatExist: string[] = []
      rows.forEach((row, index) => {
        if (codeIds.includes(row.Code)) {
          this.#addIssue(index, COL.Code, `validator.exist`, ctx)
        } else if (codeExist.includes(row.Code)) {
          this.#addIssue(index, COL.Code, `validator.duplicated`, ctx)
        } else {
          codeExist.push(row.Code)
        }
        // Validate idSatuSehat
        if (row.idSatuSehat !== undefined && row.idSatuSehat !== null) {
          // Validate exactly 10 digits
          if (String(row.idSatuSehat).length !== 10) {
            this.#addIssue(
              index,
              COL.idSatuSehat,
              c.var.t("validator.exact_length_digit", {
                field: COL.idSatuSehat,
                length: 10,
              }),
              ctx
            )
          }

          if (idSatuSehats.includes(row.idSatuSehat)) {
            this.#addIssue(index, COL.idSatuSehat, `validator.exist`, ctx)
          } else if (idSatuSehatExist.includes(row.idSatuSehat.toString())) {
            this.#addIssue(index, COL.idSatuSehat, `validator.duplicated`, ctx)
          } else {
            idSatuSehatExist.push(row.idSatuSehat.toString())
          }
        }

        this.#validateId(index, row.TypeId, typeIds, COL.TypeId, ctx)
        this.#validateId(
          index,
          row.EntityTagId,
          entityTagIds,
          COL.EntityTagId,
          ctx
        )
        this.#validateId(
          index,
          row.ProvinceId,
          provinceIds,
          COL.ProvinceId,
          ctx
        )
        this.#validateId(index, row.RegencyId, regencieIds, COL.RegencyId, ctx)
        this.#validateId(
          index,
          row.SubDistrictId,
          subdistrictIds,
          COL.SubDistrictId,
          ctx
        )
        this.#validateId(index, row.VillageId, villageIds, COL.VillageId, ctx)

        if (
          Array.isArray(row.ProgramId) &&
          !row.ProgramId.every((id) => programIds.includes(id))
        ) {
          this.#addIssue(index, COL.ProgramId, `validator.not_exist`, ctx)
        }

        this.#validateLength(c, index, row.Code, 255, COL.Code, ctx)
        this.#validateLength(c, index, row.Name, 255, COL.Name, ctx)
        this.#validateLength(c, index, row.Address, 255, COL.Address, ctx)
        this.#validateLength(c, index, row.Latitude, 255, COL.Latitude, ctx)
        this.#validateLength(c, index, row.Longitude, 255, COL.Longitude, ctx)
      })
    })
  }

  readonly #isExist = (value, ctx) => {
    if (!value) {
      ctx.addIssue({
        message: "validator.not_exist",
        code: "custom",
      })
    }
  }

  readonly #isValidArrayNumber = (value, ctx) => {
    if (
      typeof value === "string" || // Tidak boleh string
      !Array.isArray(value) || // Harus berupa array
      !value.every((item) => !isNaN(Number(item))) // Semua elemen harus angka
    ) {
      ctx.addIssue({
        message: "validator.number",
        code: "custom",
      })
      return false
    }
    return true
  }

  readonly #validateDataFromDB = async (
    ctx,
    val,
    repository,
    c,
    level = -1
  ) => {
    this.#isValidArrayNumber(val, ctx)
    if (Array.isArray(val) && val.length > 0) {
      const ids = val.map((id) => (isNaN(Number(id)) ? id : Number(id)))
      let data: { id: number }[] = []
      if (level === -1) data = await repository(c, ids)
      else data = await repository(c, ids, level)
      const dataIds = data.map((item) => item.id)
      const isExist = ids.every((item) => dataIds.includes(item))
      this.#isExist(isExist, ctx)
    }
  }

  list = (c: Context) => {
    return GetEntitiesParamsSchema.extend({
      province_ids: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          await this.#validateDataFromDB(
            ctx,
            val,
            this.locationRepo.findByIDs,
            c,
            LOCATION.PROVINCE
          )
        })
        .optional(),
      regency_ids: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          await this.#validateDataFromDB(
            ctx,
            val,
            this.locationRepo.findByIDs,
            c,
            LOCATION.REGENCY
          )
        })
        .optional(),
      sub_district_ids: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          await this.#validateDataFromDB(
            ctx,
            val,
            this.locationRepo.findByIDs,
            c,
            LOCATION.SUBDISTRICT
          )
        })
        .optional(),
      village_ids: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          await this.#validateDataFromDB(
            ctx,
            val,
            this.locationRepo.findByIDs,
            c,
            LOCATION.VILLAGE
          )
        })
        .optional(),
      entity_tag_ids: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          await this.#validateDataFromDB(
            ctx,
            val,
            this.entityTagRepo.findByIds,
            c
          )
        })
        .optional(),
      program_ids: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          await this.#validateDataFromDB(
            ctx,
            val,
            this.workspaceRepo.findAllByIds,
            c
          )
        })
        .optional(),
      type_ids: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          await this.#validateDataFromDB(
            ctx,
            val,
            this.entityTypeRepo.findByIds,
            c
          )
        })
        .optional(),
      types: generalMultipleIdSchema
        .superRefine(async (val, ctx) => {
          await this.#validateDataFromDB(
            ctx,
            val,
            this.entityTypeRepo.findByIds,
            c
          )
        })
        .optional(),
    })
  }

  create = (c: Context) => {
    const param = c.req.param("id") || undefined

    const valCondition = (val) => !val || !isNaN(Number(val))
    const validateStringMaxLength =
      (field: string, length: number) => (val: string) =>
        val.trim().length < length ||
        c.var.t("validator.max_length", { field, length })

    const validateOptionalId =
      <T>(
        repo: { findByIDs: (ctx: Context, ids: number[]) => Promise<T[]> },
        field: string
      ) =>
      async (val: string | undefined, ctx: z.RefinementCtx) => {
        if (!val || isNaN(Number(val))) return
        const result = await repo.findByIDs(c, [Number(val)])
        if (result.length === 0) {
          ctx.addIssue({
            message: c.var.t("validator.not_exist", { field }),
            code: "custom",
          })
        }
      }
    const entity_id = c.req.param("id")

    return CreateEntityRequest.extend({
      code: z
        .string()
        .refine(validateStringMaxLength("code", 255))
        .superRefine(async (val, ctx) => {
          const result = await this.entityRepo.findByCode(c, val)
          if (val === result?.code && Number(entity_id) !== result?.id) {
            ctx.addIssue({
              code: "custom",
              message: `validator.exist`,
            })
          }
        }),
      name: z.string().refine(validateStringMaxLength("name", 255)),
      address: z.string().refine(validateStringMaxLength("address", 255)),
      country: z
        .string()
        .refine(validateStringMaxLength("country", 255))
        .optional(),
      postal_code: z
        .string()
        .refine(validateStringMaxLength("postal_code", 255))
        .optional(),
      lat: z.string().refine(validateStringMaxLength("lat", 255)).optional(),
      lng: z.string().refine(validateStringMaxLength("lng", 255)).optional(),

      province_id: z
        .string()
        .refine((val) => valCondition(val), {
          message: "validator.number",
        })
        .superRefine(validateOptionalId(this.locationRepo, "province_id"))
        .optional(),

      regency_id: z
        .string()
        .refine((val) => valCondition(val), {
          message: "validator.number",
        })
        .superRefine(validateOptionalId(this.locationRepo, "regency_id"))
        .optional(),

      sub_district_id: z
        .string()
        .refine((val) => valCondition(val), {
          message: "validator.number",
        })
        .superRefine(validateOptionalId(this.locationRepo, "sub_district_id"))
        .optional(),

      village_id: z
        .string()
        .refine((val) => valCondition(val), {
          message: "validator.number",
        })
        .superRefine(validateOptionalId(this.locationRepo, "village_id"))
        .optional(),

      entity_tag_id: z.number().superRefine(async (val, ctx) => {
        const result = await this.entityTagRepo.findByIds(c, [val])
        if (result.length === 0) {
          ctx.addIssue({
            message: c.var.t("validator.not_exist", { field: "entity_tag_id" }),
            code: "custom",
          })
        }
      }),

      type: z.number().superRefine(async (val, ctx) => {
        const result = await this.entityTypeRepo.findByIds(c, [val])
        if (result.length === 0) {
          ctx.addIssue({
            message: c.var.t("validator.not_exist", { field: "type" }),
            code: "custom",
          })
        }
      }),

      program_ids: z
        .array(z.number(), { message: "validator.array" })
        .superRefine(async (val, ctx) => {
          if (val.length === 0) return
          const result = await this.workspaceRepo.findAllByIds(c, val)
          if (result.length !== val.length) {
            ctx.addIssue({
              code: "custom",
              message: `validator.not_exist`,
            })
          }
          if (!val.every((id) => !isNaN(Number(id)))) {
            ctx.addIssue({
              code: "custom",
              message: `validator.number`,
            })
          }
        })
        .nullish(),

      external_properties: z.record(z.any()).optional(),

      integration_client_id: z
        .number()
        .superRefine(async (val, ctx) => {
          const result = await c.var.trx
            .selectFrom("integration_clients as ic")
            .where("ic.id", "=", [val])
            .select(["id"])
            .execute()
          if (result.length === 0) {
            ctx.addIssue({
              message: c.var.t("validator.not_exist", {
                field: "integration_clients",
              }),
              code: "custom",
            })
          }
        })
        .optional(),

      id_satu_sehat: z
        .number({
          invalid_type_error: c.var.t("validator.number", {
            field: c.var.t("entity.label.msi_code"),
          }),
        })
        .nullable()
        .optional()
        .superRefine(async (val, ctx) => {
          if (val === null || val === undefined) {
            return
          }
          // Validate max length by converting number to string
          if (String(val).length !== 10) {
            ctx.addIssue({
              message: c.var.t("validator.exact_length_digit", {
                field: c.var.t("entity.label.msi_code"),
                length: 10,
              }),
              code: "custom",
            })
          }

          const result = await c.var.trx
            .selectFrom("entities as e")
            .where("e.id_satu_sehat", "=", Number(val))
            .select(["id"])
            .executeTakeFirst()
          if (
            (param && result && Number(param) !== result.id) ||
            (!param && result)
          ) {
            ctx.addIssue({
              message: c.var.t("validator.exist", {
                field: c.var.t("entity.label.msi_code"),
              }),
              code: "custom",
            })
          }
        }),
    })
  }
}
