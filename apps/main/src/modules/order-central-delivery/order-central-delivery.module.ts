import { DEVICE_TYPE } from "@/common/constants/device.js"
import {
  IS_ALLOCATED,
  IS_MANUAL,
  ORDER_STATUS,
  ORDER_TYPE,
} from "@/common/constants/order.js"
import { TRANSACTION_TYPE } from "@/common/constants/transaction.js"
import { TransactionPublisher } from "@/modules/transaction/transaction.publisher.js"
import { PublishTrxDTO } from "@/modules/transaction/transaction.schema.js"
import { collect } from "@smile/lib/utils.js"
import { Context } from "hono"
import _ from "lodash"
import { OrderDroppingPublisher } from "../base.order-dropping.publisher.js"
import { BatchRepository } from "../batch/batch.repository.js"
import { ContractRepository } from "../contracts/contract.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { OrderAuditRepository } from "../order-audit/order-audit.repository.js"
import { CreateOrderAuditDTO } from "../order-audit/order-audit.schema.js"
import { OrderCommentRepository } from "../order-comment/order-comment.repository.js"
import { CreateOrderCommentDTO } from "../order-comment/order-comment.schema.js"
import { OrderHistoryRepository } from "../order-history/order-history.repository.js"
import { CreateOrderHistoryDTO } from "../order-history/order-history.schema.js"
import { OrderItemStockRepository } from "../order-item-stock/order-item-stock.repository.js"
import { OrderRepository } from "../order/order.repository.js"
import { StockRepository } from "../stock/stock.repository.js"
import { TransactionRepository } from "../transaction/transaction.repository.js"
import {
  batchCodeMapping,
  CreateBatch,
  CreateOrderStockPurchase,
  CreateRequest,
  CreateStock,
} from "./order-central-delivery.schema.js"

export class OrderCentralDeliveryModule {
  constructor(
    private readonly repo: OrderRepository,
    private readonly contractRepo: ContractRepository,
    private readonly stockRepo: StockRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly manufactureRepo: ManufactureRepository,
    private readonly orderCommentRepo: OrderCommentRepository,
    private readonly batchRepo: BatchRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly orderItemStockRepo: OrderItemStockRepository,
    private readonly orderAuditRepo: OrderAuditRepository,
    private readonly orderHistoryRepo: OrderHistoryRepository,
    private readonly orderDroppingPublisher?: OrderDroppingPublisher,
    private readonly transactionPublisher?: TransactionPublisher
  ) {}

  async create(c: Context, body: CreateRequest) {
    const { order_items, order_comment, ...created } = body
    let materials = body.materials
    const userId = c.var.userId ?? 0
    const vendorId = created.vendor_id ?? 0
    const customerId = created.customer_id ?? 0
    const totalOrderItem = order_items.reduce(
      (sum, item) => sum + item.stocks.length,
      0
    )

    const materialIds = collect(order_items, "material_id")

    if (materials === undefined) {
      materials = await this.materialRepo.find(c, {
        id: materialIds,
      })
    }

    // create ws_orders
    const createOrder = await this.repo.create(c, {
      customer_id: created.customer_id,
      vendor_id: vendorId,
      order_status_id: ORDER_STATUS.SHIPPED,
      order_type_id: ORDER_TYPE.CENTRAL_DISTRIBUTION,
      activity_id: created.activity_id,
      device_type: c.var.deviceType ?? DEVICE_TYPE.web,
      is_allocated: IS_ALLOCATED.TRUE,
      no_po: created.po_number || null,
      total_order_items: totalOrderItem,
      delivery_number: created.do_number,
      delivery_type_id: created.delivery_type_id,
      created_by: userId,
      metadata: body.metadata,
    })
    const orderId = Number(createOrder.insertId)

    // create ws_contracts
    if (created.po_number) {
      const checkContract = await this.contractRepo.findOne(c, {
        contract_number: created.po_number,
      })
      if (!checkContract)
        await this.contractRepo.create(c, {
          contract_number: created.po_number,
          created_by: userId,
          updated_by: userId,
        })
    }

    const batchCode: batchCodeMapping[] = []
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_, parent] of order_items.entries()) {
      const material = materials?.find((m) => m?.id === parent.material_id)

      const batchData = await Promise.all([
        this.#createdStocks(
          c,
          userId,
          vendorId ?? 0,
          customerId,
          body.activity_id,
          orderId,
          material?.parent_id ?? null,
          parent
        ),
      ])
      batchCode.push(...batchData)
    }

    // create ws_order_audit, ws_order_history, ws_order_comment
    const orderAuditData: CreateOrderAuditDTO = {
      order_id: orderId,
      allocated_at: new Date(),
      allocated_by: userId,
      actual_shipment_date: new Date().toISOString().slice(0, 10),
      shipped_at: new Date(),
      shipped_by: userId,
      confirmed_at: new Date(),
      confirmed_by: userId,
      required_date: created.required_date,
    }
    const orderHistoryData: CreateOrderHistoryDTO = {
      order_id: orderId,
      order_status_id: ORDER_STATUS.SHIPPED,
      created_by: userId,
      updated_by: userId,
    }
    const promises = [
      this.orderAuditRepo.create(c, orderAuditData),
      this.orderHistoryRepo.create(c, orderHistoryData),
    ]
    if (order_comment) {
      const orderCommentData: CreateOrderCommentDTO = {
        order_id: orderId,
        user_id: userId,
        order_status_id: ORDER_STATUS.SHIPPED,
        comment: order_comment,
      }

      promises.unshift(this.orderCommentRepo.create(c, orderCommentData))
    }
    await Promise.all(promises)

    if (this.orderDroppingPublisher)
      await this.orderDroppingPublisher.processCreateCentralDelivery(
        c,
        orderId,
        {
          ...body,
          is_allocated: IS_ALLOCATED.FALSE,
          is_manual: IS_MANUAL.TRUE,
          batchCodeMapping: batchCode,
        }
      )

    return orderId
  }

  async #createdStocks(
    c: Context,
    userId: number,
    vendorId: number,
    consumerId: number,
    activityId: number,
    orderId: number,
    parentMaterialId: number | null,
    orderItems: Pick<
      CreateRequest["order_items"][0],
      "material_id" | "is_managed_in_batch" | "stocks" | "metadata"
    >
  ) {
    const batch: batchCodeMapping = {}
    const publishMessages: PublishTrxDTO[] = []
    const totalQty = _.sumBy(orderItems.stocks, "ordered_qty")

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [index, child] of orderItems.stocks.entries()) {
      let batchId: number | null = null
      let manufactureId: number | null = null
      // find or create batch
      const batchResult = orderItems.is_managed_in_batch
        ? await this.#findOrCreateBatch(
            c,
            {
              code: child.batch_code!,
              expired_date: child.expired_date,
              production_date: child.production_date,
              material_id: orderItems.material_id,
            },
            child.manufacture_name ?? ""
          )
        : null

      if (batchResult) {
        batchId = batchResult.batch_id
        manufactureId = batchResult.manufacture_id
        batch[child.batch_code!] = batchId
      }
      // find or create vendor stock
      const { stock: vendorStock, isNew } = await this.#findOrCreateStock(c, {
        batch_id: batchId,
        budget_source_id: child.budget_source_id,
        year: child.budget_year,
        price: (child.total_price ?? 0) / child.ordered_qty,
        total_price: child.total_price,
        created_by: userId,
        entity_id: vendorId,
        activity_id: activityId,
        material_id: orderItems.material_id,
        batch_code: child.batch_code,
        manufacture_id: manufactureId,
        parent_material_id: parentMaterialId, // need confirm for parent material
      })

      const { stock: consumerStock } = await this.#findOrCreateStock(c, {
        batch_id: batchId,
        budget_source_id: child.budget_source_id,
        year: child.budget_year,
        price: (child.total_price ?? 0) / child.ordered_qty,
        total_price: child.total_price,
        created_by: userId,
        entity_id: consumerId,
        activity_id: activityId,
        material_id: orderItems.material_id,
        batch_code: child.batch_code,
        manufacture_id: manufactureId,
        parent_material_id: parentMaterialId, // need confirm for parent material
      })
      // if vendor qty < qty order, create ws_transaction ( add stock and issue stock )
      if (Number(vendorStock?.qty) < Number(child.ordered_qty)) {
        const [addStockResult, issueStockResult] = await Promise.all([
          this.transactionRepo.create(c, {
            activity_id: activityId,
            opening_qty: vendorStock?.qty,
            change_qty: Number(child.ordered_qty),
            transaction_type_id: TRANSACTION_TYPE.ADD_STOCK,
            stock_id: vendorStock?.id,
            device_type: c.var.deviceType ?? DEVICE_TYPE.web,
            order_id: orderId,
            entity_id: vendorId,
            created_by: userId,
          }),
          this.transactionRepo.create(c, {
            activity_id: activityId,
            opening_qty: Number(child.ordered_qty),
            change_qty: -Number(child.ordered_qty),
            transaction_type_id: TRANSACTION_TYPE.ISSUES,
            stock_id: vendorStock?.id,
            device_type: c.var.deviceType ?? DEVICE_TYPE.web,
            order_id: orderId,
            entity_id: vendorId,
            created_by: userId,
          }),
        ])

        publishMessages.push(
          ...[addStockResult, issueStockResult]
            .filter((result) => result?.insertId)
            .map((result) => ({ id: Number(result.insertId) }))
        )

        // create ws_purchase for add stock and issue stock
        await Promise.all([
          this.#createOrderStockPurchase(c, {
            budget_source_id: child.budget_source_id,
            year: child.budget_year,
            price: child?.total_price
              ? child.total_price / child.ordered_qty
              : undefined,
            total_price: child.total_price,
            source_id: Number(addStockResult?.insertId),
            created_by: userId,
          }),
          this.#createOrderStockPurchase(c, {
            budget_source_id: child.budget_source_id,
            year: child.budget_year,
            price: child?.total_price
              ? child.total_price / child.ordered_qty
              : undefined,
            total_price: child.total_price,
            source_id: Number(issueStockResult?.insertId),
            created_by: userId,
            updated_by: userId,
          }),
        ])
      }
      // if qty order <= vendor qty, create ws_transaction ( issue stock )
      if (Number(child.ordered_qty) <= Number(vendorStock?.qty)) {
        const issueStockResult = await this.transactionRepo.create(c, {
          activity_id: activityId,
          opening_qty: vendorStock?.qty,
          change_qty: -Number(child.ordered_qty),
          transaction_type_id: TRANSACTION_TYPE.ISSUES,
          stock_id: vendorStock?.id,
          device_type: c.var.deviceType ?? DEVICE_TYPE.web,
          order_id: orderId,
          entity_id: vendorId,
          created_by: userId,
        })
        publishMessages.push({
          id: Number(issueStockResult?.insertId),
        })
        // create ws_purchase for issue stock
        await this.#createOrderStockPurchase(c, {
          budget_source_id: child.budget_source_id,
          year: child.budget_year,
          price: child?.total_price
            ? child.total_price / child.ordered_qty
            : undefined,
          total_price: child.total_price,
          source_id: Number(issueStockResult?.insertId),
          created_by: userId,
        })
      }

      // update stock vendor
      const vstock = await this.stockRepo.update(
        c,
        {
          qty:
            vendorStock?.qty != 0
              ? Number(vendorStock?.qty) - Number(child.ordered_qty)
              : 0,
          in_transit_qty:
            Number(vendorStock?.in_transit_qty) + Number(child.ordered_qty),
          year: child?.budget_year,
          price: child?.total_price
            ? child.total_price / child.ordered_qty
            : undefined,
          total_price: child?.total_price,
          budget_source_id: child?.budget_source_id,
          updated_by: userId,
        },
        { id: vendorStock?.id }
      )

      // update stock consumer
      const cstock = await this.stockRepo.update(
        c,
        {
          qty: Number(consumerStock?.qty),
          unreceived_qty:
            Number(consumerStock?.unreceived_qty) + Number(child.ordered_qty),
          year: child?.budget_year,
          price: child?.total_price
            ? child.total_price / child.ordered_qty
            : undefined,
          total_price: child?.total_price,
          budget_source_id: child?.budget_source_id,
          updated_by: userId,
        },
        { id: consumerStock?.id }
      )

      // create ws_order_item_stock
      await this.orderItemStockRepo.create(c, {
        order_id: orderId,
        material_id: orderItems.material_id,
        stock_id: vendorStock?.id,
        qty: totalQty,
        ordered_qty: totalQty,
        confirmed_qty: totalQty,
        allocated_qty: child.ordered_qty,
        metadata: orderItems.metadata?.[index] ?? null,
        created_by: userId,
      })

      // Push data transaction to clickhouse
      if (this.transactionPublisher)
        void this.transactionPublisher.processCreate(c, publishMessages)
    }
    return batch
  }

  async #findOrCreateBatch(
    c: Context,
    data: Omit<CreateBatch, "manufacture_id">,
    manufacture_name: string | undefined
  ) {
    const manufacture = await this.manufactureRepo.findOne(c, {
      name: manufacture_name,
    })

    const batch = await this.batchRepo.findOne(c, {
      code: data.code,
      material_id: data.material_id,
      manufacture_id: manufacture?.id,
    })

    if (batch) {
      return {
        batch_id: Number(batch.id),
        manufacture_id: manufacture?.id,
      }
    }

    const createdBatch = await this.batchRepo.create(c, {
      ...data,
      manufacture_id: manufacture?.id,
      status: 1,
    })
    return {
      batch_id: Number(createdBatch.insertId),
      manufacture_id: manufacture?.id,
    }
  }

  async #findOrCreateStock(c: Context, data: Omit<CreateStock, "qty">) {
    let stock

    if (data.batch_id) {
      stock = await this.stockRepo.findOne(c, {
        entity_id: data.entity_id ?? 0,
        material_id: data.material_id ?? 0,
        activity_id: data.activity_id ?? 0,
        batch_id: data?.batch_id,
      })
    } else {
      stock = await this.stockRepo.findOne(c, {
        entity_id: data.entity_id ?? 0,
        material_id: data.material_id ?? 0,
        activity_id: data.activity_id ?? 0,
      })
    }

    if (stock) {
      return {
        isNew: false,
        stock,
      }
    }

    const createdStock = await this.stockRepo.create(c, {
      ...data,
      qty: 0,
    })
    const stockNew = await this.stockRepo.findOne(c, {
      id: Number(createdStock.insertId),
      activity_id: data.activity_id ?? 0,
    })
    return {
      isNew: true,
      stock: stockNew,
    }
  }

  async #createOrderStockPurchase(c: Context, data: CreateOrderStockPurchase) {
    const objOrderStockPurchase: CreateOrderStockPurchase = {
      budget_source_id: data.budget_source_id,
      year: data.year,
      price: data.price,
      total_price: data.total_price,
      source_id: data.source_id,
      source_type: "transaction",
      created_by: data.created_by,
    }

    return await c.var.trx
      .insertInto("ws_purchases")
      .values(objOrderStockPurchase)
      .executeTakeFirst()
  }
}
