import { db } from "@/common/infrastructure/database/index.js"
import { getConnection } from "@/common/infrastructure/mq/index.js"
import { OrderDroppingPublisher } from "@/modules/base.order-dropping.publisher.js"
import { BatchRepository } from "@/modules/batch/batch.repository.js"
import { ContractRepository } from "@/modules/contracts/contract.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { ManufactureRepository } from "@/modules/manufacture/manufacture.repository.js"
import { MaterialRepository } from "@/modules/material/material.repository.js"
import { OrderAuditRepository } from "@/modules/order-audit/order-audit.repository.js"
import { OrderCentralDeliveryModule } from "@/modules/order-central-delivery/order-central-delivery.module.js"
import { OrderCommentRepository } from "@/modules/order-comment/order-comment.repository.js"
import { OrderHistoryRepository } from "@/modules/order-history/order-history.repository.js"
import { BiofarmaCron } from "@/modules/order-integration/biofarma/biofarma.cron.js"
import { BiofarmaGateway } from "@/modules/order-integration/biofarma/biofarma.gateway.js"
import { BiofarmaRepository } from "@/modules/order-integration/biofarma/biofarma.repository.js"
import { OrderItemStockRepository } from "@/modules/order-item-stock/order-item-stock.repository.js"
import { OrderStatusCancelModule } from "@/modules/order-status/order-status-cancel/order-status-cancel.module.js"
import { OrderStatusCancelRepository } from "@/modules/order-status/order-status-cancel/order-status-cancel.repository.js"
import { OrderStatusConfirmPublisher } from "@/modules/order-status/order-status-confirm/order-status-confirm.publisher.js"
import { OrderStatusConfirmRepository } from "@/modules/order-status/order-status-confirm/order-status-confirm.repository.js"
import { OrderRepository } from "@/modules/order/order.repository.js"
import { StockRepository } from "@/modules/stock/stock.repository.js"
import { TransactionPublisher } from "@/modules/transaction/transaction.publisher.js"
import { TransactionRepository } from "@/modules/transaction/transaction.repository.js"
import { TransactionManager } from "@smile-health/lib/database.js"
import i18n from "@smile-health/lib/i18n.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { Context } from "hono"

const materialRepo = new MaterialRepository()
const manufactureRepo = new ManufactureRepository()
const orderAuditRepo = new OrderAuditRepository()
const orderCommentRepo = new OrderCommentRepository()
const orderHistoryRepo = new OrderHistoryRepository()
const orderItemStockRepo = new OrderItemStockRepository()
const orderRepo = new OrderRepository()
const stockRepo = new StockRepository()
const transactionRepo = new TransactionRepository()
const batchRepo = new BatchRepository()
const entityRepo = new EntityRepository()

const publisher = new Publisher(getConnection)
const trxManager = new TransactionManager(db)

export const syncBiofarmaOrders = async (
  type: "hub" | "province",
  startDate: string,
  endDate: string
) => {
  await trxManager.transaction(async (trx) => {
    const c = new CustomContext({ trx, t: i18n.t })
    const client = await trx
      .selectFrom("integration_clients")
      .selectAll()
      .where("key", "=", "biofarma")
      .executeTakeFirstOrThrow()

    const cronHandler = new BiofarmaCron(
      new BiofarmaRepository(),
      new BiofarmaGateway(client),
      new OrderCentralDeliveryModule(
        orderRepo,
        new ContractRepository(),
        stockRepo,
        materialRepo,
        manufactureRepo,
        orderCommentRepo,
        batchRepo,
        transactionRepo,
        orderItemStockRepo,
        orderAuditRepo,
        orderHistoryRepo,
        new OrderDroppingPublisher(
          publisher,
          orderRepo,
          orderItemStockRepo,
          entityRepo,
          stockRepo,
          materialRepo,
          orderCommentRepo
        ),
        new TransactionPublisher(publisher, transactionRepo)
      ),
      new OrderStatusCancelModule(
        new OrderStatusCancelRepository(),
        new OrderStatusConfirmPublisher(
          publisher,
          new OrderStatusConfirmRepository()
        ),
        new TransactionPublisher(publisher, new TransactionRepository())
      )
    )

    await cronHandler.syncOrders(c as Context, type, startDate, endDate)
  })

  process.exit(0)
}

export const syncBiofarmaDashboard = async (
  type: "hub" | "province",
  startDate: string,
  endDate: string
) => {
  await trxManager.transaction(async (trx) => {
    const client = await trx
      .selectFrom("integration_clients")
      .selectAll()
      .where("key", "=", "biofarma")
      .executeTakeFirstOrThrow()

    const c = new CustomContext({
      trx,
      t: i18n.t,
      "feature-flags": (key: string, defaultValue: unknown) => defaultValue,
      "feature-enabled": () => false,
    }) as Context

    const cronHandler = new BiofarmaCron(
      new BiofarmaRepository(),
      new BiofarmaGateway(client),
      new OrderCentralDeliveryModule(
        orderRepo,
        new ContractRepository(),
        stockRepo,
        materialRepo,
        manufactureRepo,
        orderCommentRepo,
        batchRepo,
        transactionRepo,
        orderItemStockRepo,
        orderAuditRepo,
        orderHistoryRepo,
        new OrderDroppingPublisher(
          publisher,
          orderRepo,
          orderItemStockRepo,
          entityRepo,
          stockRepo,
          materialRepo,
          orderCommentRepo
        ),
        new TransactionPublisher(publisher, transactionRepo)
      ),
      new OrderStatusCancelModule(
        new OrderStatusCancelRepository(),
        new OrderStatusConfirmPublisher(
          publisher,
          new OrderStatusConfirmRepository()
        ),
        new TransactionPublisher(publisher, new TransactionRepository())
      )
    )

    await cronHandler.syncDashboard(c, type, startDate, endDate)
  })
  process.exit(0)
}
