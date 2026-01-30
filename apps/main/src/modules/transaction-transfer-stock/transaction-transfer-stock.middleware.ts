import { ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import {
  GlobalBudgetSourceDTO,
  GlobalManufactureDTO,
  GlobalMaterialDTO,
  StockDetailDTO,
  SubmitTransferStockRequest,
} from "./transaction-transfer-stock.schema.js"
import { collect } from "@smile-health/lib/utils.js"
import { TransactionTransferStockRepository } from "./transaction-transfer-stock.repository.js"

export class TransactionTransferStockMiddleware {
  constructor(
    private readonly repository: TransactionTransferStockRepository
  ) {}

  submit = async (c: Context, body: SubmitTransferStockRequest) => {
    const { entity_id, materials, companion_program_id } = body
    const listStockID = collect(materials, "stock_id")
    const listMaterialID = collect(materials, "material_id")

    const [
      globalEntity,
      stocks,
      globalMaterial,
      globalManufacture,
      globalBudgetSource,
    ] = await Promise.all([
      this.repository.findGlobalEntity(c, entity_id, companion_program_id),
      this.repository.getListStockBatch(c, listStockID),
      this.repository.getListGlobalMaterial(
        c,
        listMaterialID,
        companion_program_id
      ),
      this.repository.getListGlobalManufacture(c, listStockID),
      this.repository.getListGlobalBudgetSource(c, listStockID),
    ])

    if (!globalEntity) {
      throw new ValidationError(
        c.var.t("validator.invalid_submit_transfer_stock_entity_id")
      )
    }

    body.stocks = stocks as StockDetailDTO[]
    body.global_materials = globalMaterial as GlobalMaterialDTO[]
    body.global_manufactures = globalManufacture as GlobalManufactureDTO[]
    body.global_budget_sources = globalBudgetSource as GlobalBudgetSourceDTO[]
    body.companion_entity_id = globalEntity.entity_id_companion as number
    if (!body.is_acknowledged) {
      c.addError(`is_acknowledged`, "validator.transfer_stock_is_acknowledged")
    }
    materials.forEach((item, idx) => {
      const stock = stocks.find((stock) => {
        return stock.stock_id === item.stock_id
      })
      const material = globalMaterial.find((material) => {
        return material.material_id_source === item.material_id
      })

      if (!stock) {
        c.addError(`${idx}`, "validator.invalid_submit_transfer_stock_stock_id")
      } else if (!material) {
        c.addError(
          `${idx}`,
          "validator.invalid_submit_transfer_stock_material_id"
        )
      } else if (!material.parent_material_id_companion) {
        c.addError(
          `${idx}`,
          "validator.invalid_submit_transfer_stock_parent_material_id"
        )
      } else if (stock.qty < item.qty) {
        c.addError(
          `${idx}`,
          "validator.invalid_submit_transfer_stock_stock_qty"
        )
      } else if (
        item.qty % stock.consumption_unit_per_distribution_unit! !==
        0
      ) {
        c.addError(
          `${idx}`,
          "validator.invalid_submit_transfer_stock_stock_per_unit"
        )
      }
    })

    if (c.var.errors) {
      throw new ValidationError()
    }

    return body
  }
}
