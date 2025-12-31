import { ValidationError } from "@smile/lib/error.js"
import BaseTemplate from "@smile/lib/excel/index.js"
import { collect, getDefaultNumber } from "@smile/lib/utils.js"
import { Context } from "hono"
import { EntityRepository } from "./entity.repository.js"
import {
  ColumnImportSchema,
  ImportEntityRequestSchema,
  ImportSchemaRequest,
} from "./entity.schema.js"

export class EntityMiddleware {
  constructor(private readonly repository: EntityRepository) {}

  readonly #getColumnTranslations = (c: Context): ColumnImportSchema => {
    return {
      EntityId: c.var.t("entity.label.id_entity"),
      IsVendor: c.var.t("entity.label.is_vendor_without_question_mark"),
      Status: c.var.t("entity.label.status"),
      IsRelocation: c.var.t("entity.label.is_relocation"),
    }
  }

  import = (c: Context) => {
    const COL: ColumnImportSchema = this.#getColumnTranslations(c)
    return ImportEntityRequestSchema(COL)
  }

  // validation
  readonly #isExist = (
    c: Context,
    idx: number,
    val: string | number,
    column: string
  ) => {
    if (!val && val !== 0) {
      c.addError(idx, "validator.not_empty", column)
    }
  }

  readonly #isNumber = (
    c: Context,
    idx: number,
    val: string | number,
    column: string
  ) => {
    if (isNaN(Number(val))) {
      c.addError(idx, "validator.number", column)
    }
  }

  readonly #isBooleanNumber = (
    c: Context,
    idx: number,
    val: string | number,
    column: string
  ) => {
    if (![0, 1].includes(Number(val))) {
      c.addError(idx, "validator.boolean_number", column)
    }
  }

  validateImport = async (
    c: Context,
    rows: ImportSchemaRequest[],
    template: BaseTemplate
  ) => {
    const COL: ColumnImportSchema = this.#getColumnTranslations(c)
    const startRow = template.getStartRow()
    const dataEntry: (string | number)[] = []
    const entitySet = new Set<number>()

    rows.forEach((item) => {
      entitySet.add(getDefaultNumber(item.EntityId))
    })

    const entities = await this.repository.findByIds(c, Array.from(entitySet))
    const entityIds = collect(entities, "id")

    rows.forEach((item, index) => {
      const rowIdx = startRow + index
      if (dataEntry.includes(item.EntityId!)) {
        c.addError(rowIdx, "validator.duplicated", COL.EntityId)
      } else {
        dataEntry.push(item.EntityId!)
      }
      // check Entity Id
      this.#isExist(c, rowIdx, item.EntityId!, COL.EntityId)
      this.#isNumber(c, rowIdx, item.EntityId!, COL.EntityId)
      if (!entityIds.includes(getDefaultNumber(item.EntityId))) {
        c.addError(rowIdx, "validator.not_exist", COL.EntityId)
      }
      // check IsVendor
      this.#isExist(c, rowIdx, item.IsVendor!, COL.IsVendor)
      this.#isNumber(c, rowIdx, item.IsVendor!, COL.IsVendor)
      this.#isBooleanNumber(c, rowIdx, item.IsVendor!, COL.IsVendor)
      // check IsRelocation
      this.#isExist(c, rowIdx, item.IsRelocation!, COL.IsRelocation)
      this.#isNumber(c, rowIdx, item.IsRelocation!, COL.IsRelocation)
      this.#isBooleanNumber(c, rowIdx, item.IsRelocation!, COL.IsRelocation)
      // check Status
      this.#isExist(c, rowIdx, item.Status!, COL.Status)
      this.#isNumber(c, rowIdx, item.Status!, COL.Status)
      this.#isBooleanNumber(c, rowIdx, item.Status!, COL.Status)
    })

    if (c.var.errors) {
      throw new ValidationError()
    }
    return rows
  }
}
