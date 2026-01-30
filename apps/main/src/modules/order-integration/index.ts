import { db } from "@/common/infrastructure/database/index.js"
import { getConnection } from "@/common/infrastructure/mq/index.js"
import { AuthKeycloakMiddleware } from "@/common/middlewares/auth.middleware.js"
import { CommonMiddleware } from "@/common/middlewares/common.middleware.js"
import { AuthKeycloakService } from "@smile-health/lib/api/auth.service.js"
import { TransactionManager } from "@smile-health/lib/database.js"
import { RequestMiddleware } from "@smile-health/lib/middlewares/request.middleware.js"
import { TransactionMiddleware } from "@smile-health/lib/middlewares/transaction.middleware.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { env } from "process"
import { ActivityRepository } from "../activity/activity.repository.js"
import { OrderDroppingPublisher } from "../base.order-dropping.publisher.js"
import { BatchRepository } from "../batch/batch.repository.js"
import { BudgetSourceRepository } from "../budget-source/budget-source.repository.js"
import { ContractRepository } from "../contracts/contract.repository.js"
import { EntityActivityRepository } from "../entity-activity/entity-activity.repository.js"
import { EntityVendorRepository } from "../entity-vendor/entity-vendor.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { ManufactureRepository } from "../manufacture/manufacture.repository.js"
import { MaterialActivityRepository } from "../material-activity/material-activity.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { OrderAuditRepository } from "../order-audit/order-audit.repository.js"
import { OrderCentralDeliveryModule } from "../order-central-delivery/order-central-delivery.module.js"
import { OrderCommentRepository } from "../order-comment/order-comment.repository.js"
import { OrderHistoryRepository } from "../order-history/order-history.repository.js"
import { OrderItemStockRepository } from "../order-item-stock/order-item-stock.repository.js"
import { OrderOtherReasonRepository } from "../order-other-reason/order-other-reason.repository.js"
import { OrderStatusCancelModule } from "../order-status/order-status-cancel/order-status-cancel.module.js"
import { OrderStatusCancelRepository } from "../order-status/order-status-cancel/order-status-cancel.repository.js"
import { OrderStatusConfirmModule } from "../order-status/order-status-confirm/order-status-confirm.module.js"
import { OrderStatusConfirmPublisher } from "../order-status/order-status-confirm/order-status-confirm.publisher.js"
import { OrderStatusConfirmRepository } from "../order-status/order-status-confirm/order-status-confirm.repository.js"
import { OrderPublisher } from "../order/order.publisher.js"
import { OrderRepository } from "../order/order.repository.js"
import { StockRepository } from "../stock/stock.repository.js"
import { TransactionPublisher } from "../transaction/transaction.publisher.js"
import { TransactionRepository } from "../transaction/transaction.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { DinController } from "./din/din.controller.js"
import { DinMiddleware } from "./din/din.middleware.js"
import { DinModule } from "./din/din.module.js"
import { DinRepository } from "./din/din.repository.js"
import { OrderIntegrationRepository } from "./order-integration.repository.js"
import { OrderIntegrationWorker } from "./order-integration.worker.js"
import { SihaController } from "./siha/siha.controller.js"
import { SihaMiddleware } from "./siha/siha.middleware.js"
import { SihaModule } from "./siha/siha.module.js"
import { SihaRepository } from "./siha/siha.repository.js"

const publisher = new Publisher(getConnection)
const trxManager = new TransactionManager(db)
const consumer = new Consumer(
  getConnection,
  trxManager,
  `${env.APP_NAME}-queue`,
  false
)

const trxMiddleware = new TransactionMiddleware(trxManager)
const repo = new SihaRepository()
const authRepo = new AuthKeycloakService(
  env.AUTH_URL ?? "http://localhost:5001"
)

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
const integrationRepo = new OrderIntegrationRepository()
const userRepo = new UserRepository()
const activityRepo = new ActivityRepository()

const authMiddleware = new AuthKeycloakMiddleware(
  new UserRepository(),
  new ActivityRepository(),
  new EntityRepository(),
  integrationRepo,
  authRepo
)

const orderIntegrationModule = new SihaModule(
  orderRepo,
  orderCommentRepo,
  orderItemStockRepo,
  new OrderOtherReasonRepository(),
  new OrderAuditRepository(),
  new OrderHistoryRepository(),
  new StockRepository(),
  new OrderPublisher(
    publisher,
    new OrderRepository(),
    orderItemStockRepo,
    orderCommentRepo
  ),
  repo,
  new ExportHistoryRepository(),
  entityRepo,
  materialRepo,
  manufactureRepo,
  authRepo,
  activityRepo,
  new BudgetSourceRepository()
)

const confirmModule = new OrderStatusConfirmModule(
  new OrderStatusConfirmRepository(),
  new OrderStatusConfirmPublisher(publisher, new OrderStatusConfirmRepository())
)

const cancelModule = new OrderStatusCancelModule(
  new OrderStatusCancelRepository(),
  new OrderStatusConfirmPublisher(
    publisher,
    new OrderStatusConfirmRepository()
  ),
  new TransactionPublisher(publisher, new TransactionRepository())
)

const sihaApp = new SihaController(
  orderIntegrationModule,
  confirmModule,
  cancelModule,
  new SihaMiddleware(userRepo, activityRepo, entityRepo, repo, authRepo),
  new RequestMiddleware(),
  trxMiddleware,
  new CommonMiddleware()
)

const dinApp = new DinController(
  new DinModule(
    new DinRepository(),
    new BudgetSourceRepository(),
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
    authRepo,
    cancelModule
  ),
  new DinMiddleware(
    new DinRepository(),
    new MaterialRepository(),
    new EntityRepository(),
    new EntityActivityRepository(),
    new MaterialActivityRepository(),
    new EntityVendorRepository()
  ),
  new RequestMiddleware(),
  trxMiddleware,
  authMiddleware
)

const orderIntegrationWorker = new OrderIntegrationWorker(integrationRepo)
orderIntegrationWorker.registerWorkers(consumer)

export { consumer, dinApp, sihaApp }
