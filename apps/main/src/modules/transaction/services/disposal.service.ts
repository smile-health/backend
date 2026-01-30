import { Context } from "hono"
import { TransactionRepository } from "../transaction.repository.js"
import { ValidationError } from "@smile-health/lib/error.js"

interface DisposalFromTransactionParams {
  stockId: number
  materialId: number
  transactionReasonId: number
  quantity: number
  entityId: number
  activityId: number
}

interface DisposalMaterialItem {
  stockId: number
  materialId: number
  transactionReasonId: number
  quantity: number
}

interface DisposalFromBatchParams {
  materials: DisposalMaterialItem[]
  entityId: number
  activityId: number
}

export class DisposalService {
  constructor(private readonly repository: TransactionRepository) {}

  async createDisposalFromTransaction(
    c: Context,
    params: DisposalFromTransactionParams
  ): Promise<void> {
    const {
      stockId,
      materialId,
      transactionReasonId,
      quantity,
      entityId,
      activityId,
    } = params

    // Create disposal stock record
    const disposalStock = await this.repository.createDisposalStock(c, {
      stock_id: stockId,
      transaction_reason_id: transactionReasonId,
      disposal_discard_qty: quantity,
      disposal_received_qty: 0,
      disposal_qty: 0,
      disposal_shipped_qty: 0,
    })

    // Create disposal transaction record
    await this.repository.createDisposalTransaction(c, {
      disposal_transaction_type_id: 1, // As specified
      disposal_method_id: 1, // As specified
      entity_id: entityId,
      activity_id: activityId,
      material_id: materialId,
      stock_disposal_id: Number(disposalStock.insertId),
      opening_qty: 0, // Will be updated with actual opening qty if needed
      change_qty: -Math.abs(quantity), // Negative for disposal
      open_vial: 0,
    })
  }

  async createDisposalFromBatch(
    c: Context,
    params: DisposalFromBatchParams
  ): Promise<void> {
    const { materials, entityId, activityId } = params

    if (materials.length === 0) {
      return
    }

    // Calculate total disposal quantity for the batch
    const totalQuantity = materials.reduce(
      (sum, material) => sum + material.quantity,
      0
    )

    // Create one disposal transaction for the entire batch
    // Use the first material's data for the transaction record
    const firstMaterial = materials[0]!
    await this.repository.createDisposalTransaction(c, {
      disposal_transaction_type_id: 1, // As specified
      disposal_method_id: 1, // As specified
      entity_id: entityId,
      activity_id: activityId,
      material_id: firstMaterial.materialId, // Use first material as reference
      stock_disposal_id: 0, // Will be updated after creating disposal stocks
      opening_qty: 0, // Will be updated with actual opening qty if needed
      change_qty: -Math.abs(totalQuantity), // Negative for total disposal quantity
      open_vial: 0,
    })

    // Create disposal stock records for each material
    for (const material of materials) {
      const disposalStock = await this.repository.getDisposalStockByStockId(
        c,
        material.stockId,
        material.transactionReasonId
      )
      if (disposalStock) {
        await this.repository.updateDisposalStock(
          c,
          material.stockId,
          material.transactionReasonId,
          {
            disposal_discard_qty:
              (disposalStock?.disposal_discard_qty || 0) + material.quantity,
          }
        )
      } else {
        await this.repository.createDisposalStock(c, {
          stock_id: material.stockId,
          transaction_reason_id: material.transactionReasonId,
          disposal_discard_qty: material.quantity,
          disposal_received_qty: 0,
          disposal_qty: 0,
          disposal_shipped_qty: 0,
        })
      }
    }
  }

  async updateDisposalDiscardQty(
    c: Context,
    transactionId: number,
    stockId: number
  ) {
    const transaction = await this.repository.findOne(c, { id: transactionId })
    const disposalStock = await this.repository.getDisposalStockByStockId(
      c,
      stockId,
      Number(transaction?.transaction_reason_id ?? 0)
    )
    if (
      (disposalStock?.disposal_discard_qty ?? 0) -
        Math.abs(transaction?.change_qty ?? 0) <
      0
    ) {
      const material = await this.repository.getMaterialNameBystockId(
        c,
        stockId
      )
      throw new ValidationError(
        c.var.t("validator.material_already_disposal", {
          field: material?.material_name ?? "",
        })
      )
    }
    if (disposalStock) {
      await this.repository.updateDisposalStock(
        c,
        stockId,
        Number(transaction?.transaction_reason_id ?? 0),
        {
          disposal_discard_qty:
            (disposalStock?.disposal_discard_qty ?? 0) -
            Math.abs(transaction?.change_qty ?? 0),
        }
      )
    }
  }
}
