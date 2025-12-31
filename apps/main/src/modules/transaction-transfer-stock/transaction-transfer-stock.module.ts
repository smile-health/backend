import { DEVICE_TYPE } from "@/common/constants/device.js"
import {
  TRANSACTION_CHANGE_TYPE,
  TRANSACTION_TYPE,
} from "@/common/constants/transaction.js"
import { Context } from "hono"
import { StockRepository } from "../stock/stock.repository.js"
import { TransactionTransferStockRepository } from "./transaction-transfer-stock.repository.js"
import {
  GlobalBudgetSourceDTO,
  GlobalManufactureDTO,
  GlobalMaterialDTO,
  MaterialItem,
  StockDetailDTO,
  SubmitTransferStockRequest,
} from "./transaction-transfer-stock.schema.js"
import { TransactionTypeRepository } from "../transaction-type/transaction-type.repository.js"
import { EntityMaterialRepository } from "../entity-material/entity-material.repository.js"
import { BatchRepository } from "../batch/batch.repository.js"
import { TransactionTransferStockPublisher } from "./transaction-transfer-stock.publisher.js"
import { EntityMaterialPublisher } from "../entity-material/entity-material.publisher.js"

export class TransactionTransferStockModule {
  constructor(
    private readonly repository: TransactionTransferStockRepository,
    private readonly stockRepo: StockRepository,
    private readonly transactionTypeRepo: TransactionTypeRepository,
    private readonly entityMaterialRepo: EntityMaterialRepository,
    private readonly batchRepo: BatchRepository,
    private readonly publisher: TransactionTransferStockPublisher,
    private readonly entityMaterialPublisher: EntityMaterialPublisher
  ) {}

  readonly #getChangeQty = (
    transactionType: number,
    changeQty: number,
    currentQty: number = 0
  ) => {
    const changeVal =
      transactionType === TRANSACTION_CHANGE_TYPE.REMOVE
        ? changeQty * -1
        : changeQty
    const newVal =
      transactionType === TRANSACTION_CHANGE_TYPE.RESTOCK
        ? changeQty
        : currentQty + changeVal
    return {
      changeQty: changeVal,
      newQty: newVal,
    }
  }

  readonly #updateTransferStockOut = async (
    c: Context,
    body: SubmitTransferStockRequest,
    item: MaterialItem,
    stock: StockDetailDTO,
    transactionTypeId: number | null
  ) => {
    const { entity_id, companion_program_id } = body
    const deviceType = c.req.header("device-type")
    const { userId } = c.var
    const qtyFrom = this.#getChangeQty(3, item.qty, stock.qty)

    const [transaction] = await Promise.all([
      this.repository.create(c, {
        activity_id: stock.activity_id,
        entity_id,
        stock_id: item.stock_id,
        transaction_type_id: transactionTypeId,
        change_qty: qtyFrom.changeQty,
        opening_qty: stock.qty,
        created_by: userId!,
        updated_by: userId!,
        device_type: deviceType ? DEVICE_TYPE[deviceType] : null,
        batch_code: stock.batch_code,
        status: 1,
        companion_program_id,
        companion_activity_id: item.companion_activity_id,
        is_acknowledged: 1,
      }),
      this.stockRepo.update(
        c,
        {
          qty: qtyFrom.newQty,
        },
        {
          id: item.stock_id,
        }
      ),
    ])

    return Number(transaction.insertId)
  }

  #createEntityMaterialActivity = async (
    c: Context,
    isHierarchy: boolean,
    companionProgramId: number,
    companionEntityId: number,
    companionMaterialId: number,
    companionActivityId: number
  ) => {
    const { userId, config } = c.var
    const emma =
      await this.entityMaterialRepo.getEntityMaterialsByEntityIDandMaterialID(
        c,
        companionProgramId,
        companionEntityId,
        companionMaterialId,
        companionActivityId
      )

    if (!emma) {
      const payload = {
        entity_id: companionEntityId,
        material_id: companionMaterialId,
        activity_id: companionActivityId,
        created_by: userId,
        updated_by: userId,
      }
      await this.entityMaterialRepo
        .createEntityMaterial(c, payload)
        .then((res) => {
          return this.entityMaterialPublisher.processCreate(c, {
            id: Number(res[0]?.insertId),
            program_id: companionProgramId,
            is_hierarchy: isHierarchy
              ? config?.material.is_hierarchy_enabled
              : false,
            ...payload,
          })
        })
    }
  }

  #createManufactureWorkspace = async (
    c: Context,
    companionProgramId: number,
    manufacture?: GlobalManufactureDTO
  ) => {
    let resultId: number | null = null
    if (manufacture) {
      const { manufacture_id_companion } = manufacture
      resultId = await this.repository.createManufactureWorkspace(
        c,
        companionProgramId,
        manufacture_id_companion
      )
    }

    return resultId
  }

  #createBudgetSourceWorkspace = async (
    c: Context,
    companionProgramId: number,
    budgetSource?: GlobalBudgetSourceDTO
  ) => {
    let resultId: number | null = null
    if (budgetSource) {
      const { budget_source_id_companion } = budgetSource
      resultId = await this.repository.createBudgetSourceWorkspace(
        c,
        companionProgramId,
        budget_source_id_companion
      )
    }

    return resultId
  }

  #createBatch = async (
    c: Context,
    stocks: StockDetailDTO,
    companionMaterialId: number,
    manufactureId: number | null
  ) => {
    const { batch_code, batch_production_date, batch_expired_date } = stocks
    let resultId: number | null = null
    if (manufactureId) {
      const result = await this.batchRepo.findOne(c, {
        manufacture_id: manufactureId,
        material_id: companionMaterialId,
        code: batch_code,
      })

      if (!result) {
        const res = await this.batchRepo.create(c, {
          manufacture_id: manufactureId,
          code: batch_code,
          production_date: batch_production_date,
          expired_date: batch_expired_date,
          status: 1,
          material_id: companionMaterialId,
        })

        resultId = Number(res.insertId)
      }
    }

    return resultId
  }

  readonly #updateTransferStockIn = async (
    c: Context,
    body: SubmitTransferStockRequest,
    item: MaterialItem,
    material: GlobalMaterialDTO,
    companionEntityId: number,
    stocks: StockDetailDTO,
    transactionTypeId: number | null,
    manufacture?: GlobalManufactureDTO,
    budgetSource?: GlobalBudgetSourceDTO
  ) => {
    const deviceType = c.req.header("device-type")
    const { programId } = c.var
    const { batch_code, activity_id, price } = stocks
    const { companion_program_id } = body
    const { material_id_companion, parent_material_id_companion } = material
    const stock = await this.repository.findStockMaterial(
      c,
      material_id_companion,
      companionEntityId,
      item.companion_activity_id,
      batch_code
    )

    const qtyTo = this.#getChangeQty(1, item.qty, stock?.qty ?? 0)

    // Checking manufacture workspace and budget source workspace is exist or not
    // If not, it will create new one
    const [manufactureId, budgetSourceId] = await Promise.all([
      this.#createManufactureWorkspace(c, companion_program_id, manufacture),
      this.#createBudgetSourceWorkspace(c, companion_program_id, budgetSource),
    ])

    // Checking batch, EMMA parent material, EMMA child material, MMM child material, MMM parent material is exist or not
    // If not, it will create new one
    const [batchId] = await Promise.all([
      this.#createBatch(c, stocks, material_id_companion, manufactureId),
      // EMMA Parent Material
      this.#createEntityMaterialActivity(
        c,
        true,
        companion_program_id,
        companionEntityId,
        parent_material_id_companion,
        item.companion_activity_id
      ),
      // MMM Child Material
      this.repository.createMaterialManufacture(
        c,
        material_id_companion,
        manufactureId
      ),
      // MMM Parent Material
      this.repository.createMaterialManufacture(
        c,
        parent_material_id_companion,
        manufactureId
      ),
    ])

    let stockID = stock?.stock_id
    if (stock) {
      await this.stockRepo.update(
        c,
        {
          qty: qtyTo.newQty,
          budget_source_id: budgetSourceId,
          price: price ?? 0,
          total_price: price ? price * qtyTo.newQty : 0,
        },
        { id: stock!.stock_id }
      )
    } else {
      // Create new stock
      const stockResult = await this.stockRepo.create(c, {
        batch_id: batchId,
        budget_source_id: budgetSourceId,
        qty: qtyTo.newQty,
        price: price ?? 0,
        total_price: price ? price * qtyTo.newQty : 0,
        entity_id: companionEntityId,
        material_id: material_id_companion,
        activity_id: item.companion_activity_id,
        parent_material_id: parent_material_id_companion,
        batch_code,
        manufacture_id: manufactureId,
      })

      stockID = Number(stockResult?.insertId)
    }

    const transaction = await this.repository.create(c, {
      activity_id: item.companion_activity_id,
      entity_id: companionEntityId,
      stock_id: stockID,
      transaction_type_id: transactionTypeId,
      change_qty: qtyTo.changeQty,
      opening_qty: stock?.qty ?? 0,
      device_type: deviceType ? DEVICE_TYPE[deviceType] : null,
      batch_code,
      status: 1,
      companion_program_id: programId,
      companion_activity_id: activity_id,
      is_acknowledged: 1,
    })

    return Number(transaction.insertId)
  }

  async submit(c: Context, body: SubmitTransferStockRequest) {
    const {
      companion_entity_id,
      materials,
      stocks,
      global_materials,
      global_manufactures,
      global_budget_sources,
    } = body
    const transactionType = await this.transactionTypeRepo.findOne(c, {
      id: TRANSACTION_TYPE.TRANSFER_STOCK,
    })

    const transactionTypeId = transactionType?.id
      ? Number(transactionType.id)
      : null

    for (const item of materials) {
      const stock = stocks.find((stock) => {
        return stock.stock_id === item.stock_id
      })

      const material = global_materials.find((material) => {
        return material.material_id_source === item.material_id
      })

      const manufacture = global_manufactures.find((manufacture) => {
        return manufacture.stock_id === item.stock_id
      })

      const budgetSource = global_budget_sources.find((budgetSource) => {
        return budgetSource.stock_id === item.stock_id
      })

      if (stock && material && companion_entity_id) {
        const [trxOutId, trxInId] = await Promise.all([
          this.#updateTransferStockOut(c, body, item, stock, transactionTypeId),
          this.#updateTransferStockIn(
            c,
            body,
            item,
            material,
            companion_entity_id,
            stock,
            transactionTypeId,
            manufacture,
            budgetSource
          ),
        ])

        await this.publisher.processCreate(c, [
          { id: trxOutId },
          { id: trxInId },
        ])
      }
    }

    return true
  }
}
