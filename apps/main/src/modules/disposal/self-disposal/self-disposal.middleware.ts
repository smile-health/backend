import { Context } from "hono"
import { NotFoundError, ValidationError } from "@smile-health/lib/error.js"
import { SelfDisposalRepository } from "./self-disposal.repository.js"
import { SelfDisposalRequest } from "./self-disposal.schema.js"

export class SelfDisposalMiddleware {
  constructor(private readonly repository: SelfDisposalRepository) {}

  async validateSelfDisposal(c: Context, body: SelfDisposalRequest) {
    const { entity_id, disposal_items } = body

    // Validate entity exists
    const entity = await this.repository.findEntityById(
      c,
      Number(entity_id) || 0
    )
    if (!entity) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("common.entity"),
        })
      )
    }

    // Validate disposal items
    for (const item of disposal_items) {
      // Validate stock exists
      const stock = await this.repository.findDisposalStockById(
        c,
        Number(item.disposal_stock_id) || 0
      )
      if (!stock) {
        throw new NotFoundError(
          c.var.t("validator.not_exist", {
            field: c.var.t("transaction.label.stock"),
          })
        )
      }

      if (item.disposal_discard_qty < 0 || item.disposal_received_qty < 0) {
        throw new ValidationError(
          c.var.t("validator.not_less_than_0", {
            field: c.var.t("common.qty"),
          })
        )
      }

      // Validate disposal quantities don't exceed stock quantities
      if (item.disposal_discard_qty > stock.disposal_discard_qty) {
        throw new ValidationError(
          c.var.t("validator.not_greater_than", {
            field1: c.var.t("disposal.label.disposal_discard_quantity"),
            field2: c.var.t("disposal.label.stock_discard_quantity"),
          })
        )
      }

      if (item.disposal_received_qty > stock.disposal_received_qty) {
        throw new ValidationError(
          c.var.t("validator.not_greater_than", {
            field1: c.var.t("disposal.label.disposal_received_quantity"),
            field2: c.var.t("disposal.label.stock_received_quantity"),
          })
        )
      }
    }

    return body
  }
}
