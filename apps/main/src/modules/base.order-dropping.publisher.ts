import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { OrderItemStockRepository } from "./order-item-stock/order-item-stock.repository.js"
import { CreateOrderAllocationRequest } from "./order-allocation/order-allocation.schema.js"
import { StockRepository } from "./stock/stock.repository.js"
import { MaterialRepository } from "./material/material.repository.js"
import { pick } from "@smile/lib/utils.js"
import { EntityRepository } from "./entity/entity.repository.js"
import { OrderRepository } from "./order/order.repository.js"
import { CreateRequest } from "./order-central-delivery/order-central-delivery.schema.js"
import { OrderReturnRequest } from "./order-return/order-return.schema.js"
import { OrderCommentRepository } from "./order-comment/order-comment.repository.js"

export class OrderDroppingPublisher extends SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected readonly repo: OrderRepository,
    protected readonly orderItemStockRepo: OrderItemStockRepository,
    protected readonly entityRepo: EntityRepository,
    protected readonly stockRepo: StockRepository,
    protected readonly materialRepo: MaterialRepository,
    protected readonly orderCommentRepo: OrderCommentRepository
  ) {
    super(publisher)
  }

  async processCreate(
    c: Context,
    orderId: bigint | number | undefined,
    req: CreateOrderAllocationRequest | OrderReturnRequest
  ): Promise<void> {
    const orderWorkspace = await this.repo.findOne(c, { id: orderId })
    const orderItemsWorkspace = await this.orderItemStockRepo.find(c, {
      order_id: orderId,
    })
    const orderCommentWorkspace = await this.orderCommentRepo.findOne(c, {
      order_id: orderId,
    })

    const vendor = await this.entityRepo.findOne(c, { id: req.vendor_id })
    const customer = await this.entityRepo.findOne(c, { id: req.customer_id })

    const materialIds = req.order_items.map(
      (orderItem) => orderItem.material_id
    )
    const materials = await this.materialRepo.find(c, { id: materialIds })

    const vendorStockIds = req.order_items.flatMap((orderItem) =>
      orderItem.stocks.map((stock) => stock.stock_id)
    )

    const vendorStocks = await this.stockRepo.findDetails(c, {
      entity_id: req.vendor_id,
      stock_ids: vendorStockIds,
      group_by: "material",
      material_ids: materialIds,
    })

    if (orderWorkspace) {
      const payload = {
        ...pick(req, ["activity_id", "order_comment", "required_date"]),
        ...pick(orderWorkspace, ["id", "order_type_id", "order_status_id"]),
        is_alocated: req.is_allocated,
        vendor_code: vendor!.code,
        customer_code: customer!.code,
        order_items: req.order_items.map((orderItem) => {
          const orderItemWorkspaceId = orderItemsWorkspace.find(
            (orderItemWorkspace) =>
              orderItemWorkspace.material_id === orderItem.material_id
          )!.id

          const material = materials.find(
            (m) => m.id === orderItem.material_id
          )!

          return {
            id: orderItemWorkspaceId,
            material_id: orderItem.material_id,
            material_code: material.code,
            material_managed_by_batch: material.is_managed_in_batch,
            stocks: orderItem.stocks.map((stock) => ({
              ...vendorStocks.find(
                (vendorStock) => stock.stock_id === vendorStock.id
              ),
              qty: stock.allocated_qty,
            })),
          }
        }),
        order_comment_id: orderCommentWorkspace?.id,
        program_id: c.get("programId"),
      }

      const message = {
        headers: c.req.header(),
        payload: payload,
      }

      c.addEvent(TOPIC.ORDER_DROPPING_CREATED, message)
    }
  }

  async processCreateCentralDelivery(
    c: Context,
    orderId: bigint | number | undefined,
    req: CreateRequest
  ): Promise<void> {
    const orderWorkspace = await this.repo.findOne(c, { id: orderId })
    const orderItemsWorkspace = await this.orderItemStockRepo.find(c, {
      order_id: orderId,
    })

    const vendor = await this.entityRepo.findOne(c, { id: req.vendor_id })
    const customer = await this.entityRepo.findOne(c, { id: req.customer_id })

    const materialIds = req.order_items.map(
      (orderItem) => orderItem.material_id
    )
    const materials = await this.materialRepo.find(c, { id: materialIds })

    if (orderWorkspace) {
      const payload = {
        ...pick(req, [
          "activity_id",
          "order_comment",
          "required_date",
          "is_allocated",
          "is_manual",
          "batchCodeMapping",
        ]),
        ...pick(orderWorkspace, ["id", "order_type_id", "order_status_id"]),
        vendor_code: vendor!.code,
        customer_code: customer!.code,
        order_items: req.order_items.map((orderItem) => {
          const orderItemWorkspaceId = orderItemsWorkspace.find(
            (orderItemWorkspace) =>
              orderItemWorkspace.material_id === orderItem.material_id
          )!.id

          const material = materials.find(
            (m) => m.id === orderItem.material_id
          )!

          return {
            id: orderItemWorkspaceId,
            material_id: orderItem.material_id,
            material_code: material.code,
            material_managed_by_batch: material.is_managed_in_batch,
            stocks: orderItem.stocks.map((stock) => ({
              activity_id: stock.activity_id,
              qty: stock.ordered_qty,
              batch: {
                code: stock.batch_code,
                production_date: stock.production_date,
                expired_date: stock.expired_date,
                manufacture: {
                  name: stock.manufacture_name,
                },
              },
              budget_source: {
                id: stock.budget_source_id,
              },
              budget_year: stock.budget_year,
              total_price: stock.total_price,
            })),
          }
        }),
        program_id: c.get("programId"),
      }

      const message = {
        headers: c.req.header(),
        payload: payload,
      }

      c.addEvent(TOPIC.ORDER_DROPPING_CREATED, message)
    }
  }
}
