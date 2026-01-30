import { USER_ROLE } from "@/common/constants/user.js"
import { BaseMiddleware } from "@smile-health/lib/base/middleware.js"
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@smile-health/lib/error.js"
import { formatExcelErrors } from "@smile-health/lib/zod.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { validator } from "hono/validator"
import { z } from "zod"
import { AnnualCommitmentImport } from "./annual-commitment.excel.js"
import { AnnualCommitmentRepository } from "./annual-commitment.repository.js"
import {
  CreateAnnualCommitmentBodyRequest,
  CreateAnnualCommitmentBodyRequestSchema,
  GetAnnualCommitmentQueryParams,
  GetAnnualCommitmentQueryParamsSchema,
  ImportAnnualCommitmentArrayRequest,
  ImportAnnualCommitmentArrayRequestSchema,
  ImportAnnualCommitmentRowRequest,
  UpdatesAnnualCommitmentBodyRequest,
  UpdatesAnnualCommitmentBodyRequestSchema,
} from "./annual-commitment.schema.js"

export class AnnualCommitmentMiddleware extends BaseMiddleware {
  constructor(private readonly repository: AnnualCommitmentRepository) {
    super()
  }

  readonly #queryParamValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: GetAnnualCommitmentQueryParams
  ) => {
    if (data.sort_by && !data.sort_type) {
      ctx.addIssue({
        path: ["sort_type"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("common.sort_type"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }

    if (!data.sort_by && data.sort_type) {
      ctx.addIssue({
        path: ["sort_by"],
        message: c.var.t("validator.must_be_filled", {
          field: c.var.t("common.sort_by"),
        }),
        code: z.ZodIssueCode.custom,
      })
    }
  }

  readonly #pathParamValidation = async (c: Context) => {
    const id = c.req.param("id")
    const { roleId, entityId } = c.var
    const commitment = await this.repository.getAnnualCommitmentIdById(
      c,
      Number(id),
      c.get("programId")
    )

    if (!commitment) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("annual_commitment.label.id"),
        })
      )
    } else {
      if (commitment.deleted_at) {
        throw new NotFoundError(
          c.var.t("validator.delete", {
            field: c.var.t("annual_commitment.label.id"),
          })
        )
      } else {
        if (
          roleId === USER_ROLE.MANUFACTURE &&
          commitment.vendor_id !== Number(entityId)
        ) {
          throw new NotFoundError(
            c.var.t("validator.not_exist", {
              field: c.var.t("annual_commitment.label.id"),
            })
          )
        }
      }
    }
  }

  readonly #getQueries = (c: Context) => {
    const programId = c.get("programId")

    return {
      commitments: () => this.repository.getCommitments(c, programId),
      contracts: () => this.repository.getContracts(c),
      vendors: () => this.repository.getVendors(c, programId),
      commitmentItems: () => this.repository.getCommitmentItems(c),
      provinces: () => this.repository.getProvinces(c),
      materials: () => this.repository.getMaterials(c, programId),
    }
  }

  readonly #getValue = (
    dataSource: any[],
    filterValue: string,
    comparisonValue: any,
    returnValue: string
  ) => {
    if (!comparisonValue) return null

    const result =
      dataSource.find((data) => data[filterValue] === comparisonValue)?.[
        returnValue
      ] ?? null

    return result
  }

  readonly #createQueries = async (c: Context) => {
    const { commitments, contracts, vendors, provinces, materials } =
      this.#getQueries(c)

    const [
      commitmentData,
      contractData,
      vendorData,
      provinceData,
      materialData,
    ] = await Promise.all([
      commitments(),
      contracts(),
      vendors(),
      provinces(),
      materials(),
    ])

    return {
      commitmentData,
      contractData,
      vendorData,
      provinceData,
      materialData,
    }
  }

  readonly #updateQueries = async (c: Context) => {
    const {
      commitments,
      contracts,
      vendors,
      commitmentItems,
      provinces,
      materials,
    } = this.#getQueries(c)

    const [
      commitmentData,
      contractData,
      vendorData,
      commitmentItemData,
      provinceData,
      materialData,
    ] = await Promise.all([
      commitments(),
      contracts(),
      vendors(),
      commitmentItems(),
      provinces(),
      materials(),
    ])

    return {
      commitmentData,
      contractData,
      vendorData,
      commitmentItemData,
      provinceData,
      materialData,
    }
  }

  readonly #onlyVendorQueries = async (c: Context) => {
    const { vendors } = this.#getQueries(c)

    const vendorData = await vendors()

    return vendorData
  }

  readonly #dataValidation = (
    ctx: z.RefinementCtx,
    path: (string | number | any)[],
    validator: any
  ) => {
    // const issuePath = typeof path === "string" ? [path] : path
    ctx.addIssue({
      path: path,
      message: validator,
      code: z.ZodIssueCode.custom,
    })
  }

  readonly #makeKeyItem = (provinceId: number | null, materialId: number) => {
    return [provinceId, materialId].join("|")
  }

  readonly #generalCommitmentCheck = (
    c: Context,
    data: CreateAnnualCommitmentBodyRequest,
    ctx: z.RefinementCtx,
    vendors: any[]
  ) => {
    // vendors check
    const vendorId = this.#getValue(vendors, "id", data.vendor_id, "id")

    if (!vendorId) {
      this.#dataValidation(ctx, ["vendor_id"], "validator.not_exist")
    }

    // contract start and end date check
    if (data.contract_start_date > data.contract_end_date) {
      this.#dataValidation(
        ctx,
        ["contract_start_date"],
        c.var.t("validator.not_greater_than", {
          field1: c.var.t("annual_commitment.label.contract_start_date"),
          field2: c.var.t("annual_commitment.label.contract_end_date"),
        })
      )
      this.#dataValidation(
        ctx,
        ["contract_end_date"],
        c.var.t("validator.not_less_than", {
          field1: c.var.t("annual_commitment.label.contract_end_date"),
          field2: c.var.t("annual_commitment.label.contract_start_date"),
        })
      )
    }
  }

  readonly #createCommitmentCheck = (
    c: Context,
    data: CreateAnnualCommitmentBodyRequest,
    ctx: z.RefinementCtx,
    commitments: any[],
    contracts: any[],
    vendors: any[]
  ) => {
    // contract check
    const contractId = this.#getValue(
      contracts,
      "contract_number",
      data.contract_number.trim(),
      "id"
    )

    if (contractId) {
      const commitmentContractId = this.#getValue(
        commitments,
        "contract_id",
        contractId,
        "contract_id"
      )

      if (commitmentContractId) {
        this.#dataValidation(ctx, ["contract_number"], "validator.duplicated")
      }
    }

    // general check
    this.#generalCommitmentCheck(c, data, ctx, vendors)
  }

  readonly #updateCommitmentCheck = (
    c: Context,
    data: CreateAnnualCommitmentBodyRequest,
    ctx: z.RefinementCtx,
    commitments: any[],
    contracts: any[],
    vendors: any[]
  ) => {
    const paramId = Number(c.req.param("id"))
    const programId = c.get("programId")

    // contract check
    const contractId = this.#getValue(
      contracts,
      "contract_number",
      data.contract_number.trim(),
      "id"
    )

    if (contractId) {
      const commitmentContractId = this.#getValue(
        commitments,
        "contract_id",
        contractId,
        "contract_id"
      )

      const commitmentId = this.#getValue(
        commitments,
        "contract_id",
        contractId,
        "id"
      )

      if (commitmentContractId && paramId !== commitmentId) {
        this.#dataValidation(ctx, ["contract_number"], "validator.duplicated")
      }

      // commitment check
      const commitmentProgramId = this.#getValue(
        commitments,
        "id",
        paramId,
        "program_id"
      )

      if (commitmentProgramId !== programId) {
        this.#dataValidation(ctx, ["program_id"], "validator.invalid")
      }

      const commitmentDeletedAt = this.#getValue(
        commitments,
        "id",
        paramId,
        "deleted_at"
      )

      if (commitmentDeletedAt) {
        this.#dataValidation(ctx, ["id"], "validator.delete")
      }
    }

    // general check
    this.#generalCommitmentCheck(c, data, ctx, vendors)
  }

  readonly #generalCommitmentItemCheck = async (
    ctx: z.RefinementCtx,
    provinces: any[],
    materials: any[],
    item: any,
    index: number,
    listKey: string[]
  ) => {
    // duplicate province and material check
    const key = this.#makeKeyItem(item.province_id ?? null, item.material_id)

    if (listKey.includes(key)) {
      if (item.province_id) {
        this.#dataValidation(
          ctx,
          ["items", index, "province_id"],
          "validator.duplicated"
        )
      }
      this.#dataValidation(
        ctx,
        ["items", index, "material_id"],
        "validator.duplicated"
      )
    } else {
      listKey.push(key)
    }

    // province check
    if (item.province_id) {
      const provinceId = this.#getValue(provinces, "id", item.province_id, "id")

      if (!provinceId) {
        this.#dataValidation(
          ctx,
          ["items", index, "province_id"],
          "validator.not_exist"
        )
      }
    }

    // material check
    const materialId = this.#getValue(materials, "id", item.material_id, "id")

    if (!materialId) {
      this.#dataValidation(
        ctx,
        ["items", index, "material_id"],
        "validator.not_exist"
      )
    }

    const materialUnit = this.#getValue(
      materials,
      "id",
      item.material_id,
      "consumption_unit_per_distribution_unit"
    )

    const reCalculateDoseQty = item.vial_quantity * materialUnit
    if (item.dose_quantity !== reCalculateDoseQty) {
      this.#dataValidation(
        ctx,
        ["items", index, "dose_quantity"],
        "validator.invalid"
      )
    }
  }

  readonly #createCommitmentItemCheck = async (
    c: Context,
    data: CreateAnnualCommitmentBodyRequest,
    ctx: z.RefinementCtx,
    provinces: any[],
    materials: any[]
  ) => {
    const listKey: string[] = []
    const items = data.items

    if (items && items.length > 0) {
      for (const [index, item] of items.entries()) {
        // general check
        this.#generalCommitmentItemCheck(
          ctx,
          provinces,
          materials,
          item,
          index,
          listKey
        )
      }
    }
  }

  readonly #updateCommitmentItemCheck = async (
    c: Context,
    data: UpdatesAnnualCommitmentBodyRequest,
    ctx: z.RefinementCtx,
    commitmentItems: any[],
    provinces: any[],
    materials: any[]
  ) => {
    const paramId = Number(c.req.param("id"))
    const listKey: string[] = []
    const items = data.items

    if (items && items.length > 0) {
      for (const [index, item] of items.entries()) {
        // commitment item check
        if (item.id) {
          const commitmentItemId = this.#getValue(
            commitmentItems,
            "id",
            item.id,
            "id"
          )

          const commitmentId = this.#getValue(
            commitmentItems,
            "id",
            item.id,
            "commitment_id"
          )

          const commitmentItemDeletedAt = this.#getValue(
            commitmentItems,
            "id",
            item.id,
            "deleted_at"
          )

          if (!commitmentItemId) {
            this.#dataValidation(
              ctx,
              ["items", index, "item_id"],
              "validator.not_exist"
            )
          } else {
            if (commitmentId !== paramId) {
              this.#dataValidation(
                ctx,
                ["items", index, "item_id"],
                "validator.invalid"
              )
            } else {
              if (commitmentItemDeletedAt) {
                this.#dataValidation(
                  ctx,
                  ["items", index, "item_id"],
                  "validator.delete"
                )
              }
            }
          }

          // existing delivery type and material check
          const deliveryTypeId = this.#getValue(
            commitmentItems,
            "id",
            item.id,
            "delivery_type_id"
          )

          const materialId = this.#getValue(
            commitmentItems,
            "id",
            item.id,
            "material_id"
          )

          if (
            (item.province_id && deliveryTypeId === 3) ||
            (!item.province_id && deliveryTypeId === 1)
          ) {
            this.#dataValidation(
              ctx,
              ["items", index, "province_id"],
              "validator.invalid"
            )
          }

          if (item.material_id !== materialId) {
            this.#dataValidation(
              ctx,
              ["items", index, "material_id"],
              "validator.invalid"
            )
          }
        }

        // general check
        this.#generalCommitmentItemCheck(
          ctx,
          provinces,
          materials,
          item,
          index,
          listKey
        )
      }
    }
  }

  readonly #generateImportData = async (c: Context) => {
    const body = await c.req.parseBody()
    const file = body.file as File
    const usedTemplate = new AnnualCommitmentImport()
    await usedTemplate.loadFromBuffer(await file.arrayBuffer())
    const rows = usedTemplate.getRows()
    const startRow = usedTemplate.getStartRow()

    const rowsResult = rows.map((obj) => {
      const newObj = {}

      if (obj[c.var.t("annual_commitment.label.contract_number")]) {
        newObj["contract_number"] =
          obj[c.var.t("annual_commitment.label.contract_number")]
      }

      if (obj[c.var.t("annual_commitment.label.contract_start_date")]) {
        newObj["contract_start_date"] =
          obj[c.var.t("annual_commitment.label.contract_start_date")]
      }

      if (obj[c.var.t("annual_commitment.label.contract_end_date")]) {
        newObj["contract_end_date"] =
          obj[c.var.t("annual_commitment.label.contract_end_date")]
      }

      if (obj[c.var.t("annual_commitment.label.year")]) {
        newObj["year"] = obj[c.var.t("annual_commitment.label.year")]
      }

      if (obj[c.var.t("annual_commitment.label.information")]) {
        newObj["information"] =
          obj[c.var.t("annual_commitment.label.information")]
      }

      if (obj[c.var.t("annual_commitment.label.vendor_id")]) {
        newObj["vendor_id"] = obj[c.var.t("annual_commitment.label.vendor_id")]
      }

      if (obj[c.var.t("annual_commitment.label.province_id")]) {
        newObj["province_id"] =
          obj[c.var.t("annual_commitment.label.province_id")]
      }

      if (obj[c.var.t("annual_commitment.label.material_id")]) {
        newObj["material_id"] =
          obj[c.var.t("annual_commitment.label.material_id")]
      }

      if (obj[c.var.t("annual_commitment.label.vial_quantity")]) {
        newObj["vial_quantity"] =
          obj[c.var.t("annual_commitment.label.vial_quantity")]
      }

      return newObj
    })

    const usedSchema = ImportAnnualCommitmentArrayRequestSchema.superRefine(
      async (data, ctx) => {
        if (data.length === 0) {
          this.#rowsCannotEmpty(c, ctx)
        }
        await this.#importValidation(c, ctx, data)
      }
    ).transform((rows) => rows.map(this.transformRowSchema))

    const result = await usedSchema.safeParseAsync(rowsResult)

    if (!result.success) {
      const newError: any = { issues: [] }

      for (const err of result.error.issues) {
        if (err.message === "Required") {
          newError.issues.push({
            path: err.path,
            message: c.var.t("validator.required", {
              field: c.var.t(`annual_commitment.label.${err.path[1]}`),
            }),
            code: z.ZodIssueCode.custom,
          })
        } else {
          newError.issues.push({
            path: err.path,
            message: c.var.t(err.message, {
              field: c.var.t(`annual_commitment.label.${err.path[1]}`),
            }),
            code: z.ZodIssueCode.custom,
          })
        }
      }

      c.set("errors", formatExcelErrors(newError, startRow, c.var.t))
      throw new ValidationError()
    }

    return result.data
  }

  transformRowSchema = (row: ImportAnnualCommitmentRowRequest) => {
    return {
      contract_number: row["contract_number"],
      contract_start_date: new Date(row["contract_start_date"]),
      contract_end_date: new Date(row["contract_end_date"]),
      year: row["year"],
      information: row["information"],
      vendor_id: row["vendor_id"],
      province_id: row["province_id"],
      material_id: row["material_id"],
      vial_quantity: row["vial_quantity"],
    }
  }

  readonly #rowsCannotEmpty = (c: Context, ctx: z.RefinementCtx) => {
    ctx.addIssue({
      path: ["rows"],
      message: c.var.t("validator.not_empty", {
        field: c.var.t("common.rows"),
      }),
      code: z.ZodIssueCode.custom,
    })
  }

  readonly #makeKeyImport = (
    contractNumber,
    contractStartDate,
    contractEndDate,
    year,
    information,
    vendorId
  ) => {
    return [
      contractNumber,
      contractStartDate,
      contractEndDate,
      year,
      information,
      vendorId,
    ].join("|")
  }

  readonly #makeKeyItemImport = (contractNumber, provinceId, materialId) => {
    return [contractNumber, provinceId, materialId].join("|")
  }

  readonly #isYYYYMMDD = (strDate: string) => {
    return /^\d{4}-\d{2}-\d{2}$/.test(strDate)
  }

  readonly #importValidation = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: ImportAnnualCommitmentArrayRequest
  ) => {
    const { roleId, entityId } = c.var
    const {
      commitmentData,
      contractData,
      vendorData,
      provinceData,
      materialData,
    } = await this.#createQueries(c)
    this.#manufactureAllowed(c, vendorData)
    const listImportKey: string[] = []
    const listImportKeyItem: string[] = []
    const listContractNumber: string[] = []
    for (const [index, d] of data.entries()) {
      // duplicate commitment check in sheet
      const importKey = this.#makeKeyImport(
        d["contract_number"].trim(),
        d["contract_start_date"],
        d["contract_end_date"],
        d["year"],
        d["information"],
        d["vendor_id"]
      )

      if (!listContractNumber.includes(d["contract_number"].trim())) {
        listContractNumber.push(d["contract_number"].trim())
        listImportKey.push(importKey)
      } else {
        if (!listImportKey.includes(importKey)) {
          listImportKey.push(importKey)

          this.#dataValidation(
            ctx,
            [index, "contract_number"],
            c.var.t("validator.duplicated", {
              field: c.var.t("annual_commitment.label.contract_number"),
            })
          )
        }
      }

      // contract check
      const contractId = this.#getValue(
        contractData,
        "contract_number",
        d["contract_number"].trim(),
        "id"
      )

      if (contractId) {
        const commitmentContractId = this.#getValue(
          commitmentData,
          "contract_id",
          contractId,
          "contract_id"
        )

        if (commitmentContractId) {
          this.#dataValidation(
            ctx,
            [index, "contract_number"],
            "validator.duplicated"
          )
        }
      }

      // vendor check
      const vendorId = this.#getValue(vendorData, "id", d["vendor_id"], "id")

      if (!vendorId) {
        this.#dataValidation(ctx, [index, "vendor_id"], "validator.not_exist")
      }

      if (roleId === USER_ROLE.MANUFACTURE) {
        if (vendorId !== Number(entityId)) {
          this.#dataValidation(
            ctx,
            [index, "vendor_id"],
            "validator.not_allowed"
          )
        }
      }

      // contract start and end date check
      const isStartDateCorrectFormat = this.#isYYYYMMDD(
        d["contract_start_date"]
      )

      const isEndDateCorrectFormat = this.#isYYYYMMDD(d["contract_end_date"])

      if (!isStartDateCorrectFormat) {
        this.#dataValidation(
          ctx,
          [index, "contract_start_date"],
          "validator.invalid"
        )
      }

      if (!isEndDateCorrectFormat) {
        this.#dataValidation(
          ctx,
          [index, "contract_end_date"],
          "validator.invalid"
        )
      }

      if (isStartDateCorrectFormat && isEndDateCorrectFormat) {
        const startDateConverted = new Date(d["contract_start_date"])
        const endDateConverted = new Date(d["contract_end_date"])

        if (startDateConverted > endDateConverted) {
          this.#dataValidation(
            ctx,
            [index, "contract_start_date"],
            c.var.t("validator.not_greater_than", {
              field1: c.var.t("annual_commitment.label.contract_start_date"),
              field2: c.var.t("annual_commitment.label.contract_end_date"),
            })
          )
          this.#dataValidation(
            ctx,
            [index, "contract_end_date"],
            c.var.t("validator.not_less_than", {
              field1: c.var.t("annual_commitment.label.contract_end_date"),
              field2: c.var.t("annual_commitment.label.contract_start_date"),
            })
          )
        }
      }

      // duplicate province and material check
      const keyItemImport = this.#makeKeyItemImport(
        d["contract_number"].trim(),
        d["province_id"] ?? null,
        d["material_id"]
      )

      if (listImportKeyItem.includes(keyItemImport)) {
        if (d["province_id"]) {
          this.#dataValidation(
            ctx,
            [index, "province_id"],
            "validator.duplicated"
          )
        }
        this.#dataValidation(
          ctx,
          [index, "material_id"],
          "validator.duplicated"
        )
      } else {
        listImportKeyItem.push(keyItemImport)
      }

      // province check
      if (d["province_id"]) {
        const provinceId = this.#getValue(
          provinceData,
          "id",
          d["province_id"],
          "id"
        )

        if (!provinceId) {
          this.#dataValidation(
            ctx,
            [index, "province_id"],
            "validator.not_exist"
          )
        }
      }

      // material check
      const materialId = this.#getValue(
        materialData,
        "id",
        d["material_id"],
        "id"
      )

      if (!materialId) {
        this.#dataValidation(ctx, [index, "material_id"], "validator.not_exist")
      }
    }
  }

  readonly #manufactureAllowed = (c: Context, vendors: any[]) => {
    const { roleId, entityId } = c.var

    if (roleId === USER_ROLE.MANUFACTURE) {
      const vendorId = this.#getValue(vendors, "id", entityId, "id")
      if (!vendorId) {
        throw new ForbiddenError()
      }
    }
  }

  readonly #postManufactureAllowed = (
    c: Context,
    ctx: z.RefinementCtx,
    vendorId: number
  ) => {
    const { roleId, entityId } = c.var

    if (roleId === USER_ROLE.MANUFACTURE && vendorId !== Number(entityId)) {
      this.#dataValidation(ctx, ["vendor_id"], "validator.not_allowed")
    }
  }

  list = (c: Context) => {
    return GetAnnualCommitmentQueryParamsSchema.superRefine(
      async (data, ctx) => {
        const vendorData = await this.#onlyVendorQueries(c)
        this.#manufactureAllowed(c, vendorData)
        await this.#queryParamValidation(c, ctx, data)
      }
    )
  }

  detail = createMiddleware(async (c, next) => {
    const vendorData = await this.#onlyVendorQueries(c)
    this.#manufactureAllowed(c, vendorData)
    await this.#pathParamValidation(c)
    await next()
  })

  create = (c: Context) => {
    return CreateAnnualCommitmentBodyRequestSchema.superRefine(
      async (data, ctx) => {
        const {
          commitmentData,
          contractData,
          vendorData,
          provinceData,
          materialData,
        } = await this.#createQueries(c)
        this.#manufactureAllowed(c, vendorData)
        this.#postManufactureAllowed(c, ctx, data.vendor_id)
        this.#createCommitmentCheck(
          c,
          data,
          ctx,
          commitmentData,
          contractData,
          vendorData
        )
        this.#createCommitmentItemCheck(
          c,
          data,
          ctx,
          provinceData,
          materialData
        )
      }
    )
  }

  update = (c: Context) => {
    return UpdatesAnnualCommitmentBodyRequestSchema.superRefine(
      async (data, ctx) => {
        const {
          commitmentData,
          contractData,
          vendorData,
          commitmentItemData,
          provinceData,
          materialData,
        } = await this.#updateQueries(c)
        this.#manufactureAllowed(c, vendorData)
        await this.#pathParamValidation(c)
        this.#postManufactureAllowed(c, ctx, data.vendor_id)
        this.#updateCommitmentCheck(
          c,
          data,
          ctx,
          commitmentData,
          contractData,
          vendorData
        )
        this.#updateCommitmentItemCheck(
          c,
          data,
          ctx,
          commitmentItemData,
          provinceData,
          materialData
        )
      }
    )
  }

  import = validator("json", async (value, c) => {
    const result = await this.#generateImportData(c)
    return result
  })

  template = createMiddleware(async (c, next) => {
    const vendorData = await this.#onlyVendorQueries(c)
    this.#manufactureAllowed(c, vendorData)
    await next()
  })
}
