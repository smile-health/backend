import path from "path"
import { Context } from "hono"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"

export class OrderTemplate extends BaseTemplate {
  constructor(
    startRow = 10,
    startSheet = 1,
    processor = PROCESSOR.XLSXPOPULATE
  ) {
    super(startRow, startSheet, processor)
  }

  async setRows(sheet: string, rows: AsyncIterableIterator<object> | object[]) {
    return this.addRows(sheet, rows)
  }
}

export class OrderVARTemplate extends OrderTemplate {
  constructor() {
    super()
  }

  async loadFile(c: Context) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "order",
      `order_detail_var_${c.var.language}.xlsx`
    )

    await this.loadFromFile(templatePath)
  }
}

export class OrderSBBKTemplate extends OrderTemplate {
  constructor() {
    super()
  }

  async loadFile(c: Context) {
    const { language } = c.var
    const filename = c.var.config?.material.is_hierarchy_enabled
      ? `order_detail_sbbk_logistic_${language}.xlsx`
      : `order_detail_sbbk_${language}.xlsx`
    const templatePath = path.resolve("public", "templates", "order", filename)

    await this.loadFromFile(templatePath)
  }
}

export class OrderNotaBatchTemplate extends OrderTemplate {
  constructor() {
    super()
  }

  async loadFile(c: Context) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "order",
      `order_detail_nota_batch_${c.var.language}.xlsx`
    )

    await this.loadFromFile(templatePath)
  }
}

export class OrderNotaConfirmationTemplate extends OrderTemplate {
  constructor() {
    super()
  }

  async loadFile(c: Context) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "order",
      `order_detail_nota_confirmation_${c.var.language}.xlsx`
    )

    await this.loadFromFile(templatePath)
  }
}

export class OrderRequestLetterTemplate extends OrderTemplate {
  constructor() {
    super()
  }

  async loadFile(c: Context) {
    const templatePath = path.resolve(
      "public",
      "templates",
      "order",
      `order_detail_request_letter_${c.var.language}.xlsx`
    )

    await this.loadFromFile(templatePath)
  }
}
