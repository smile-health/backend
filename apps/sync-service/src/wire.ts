import { TransactionManager } from "@smile-health/lib/database.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { env } from "process"
import { db } from "./common/infrastructure/database/index.js"
import { getConnection } from "./common/infrastructure/mq/index.js"
import { ActivityGateway } from "./services/activity/activity.gateway.js"
import { ActivityWorker } from "./services/activity/activity.worker.js"
import { BudgetSourceGateway } from "./services/budget-source/budget-source.gateway.js"
import { BudgetSourceRepository } from "./services/budget-source/budget-source.repository.js"
import { BudgetSourceWorker } from "./services/budget-source/budget-source.worker.js"
import { EntityCustomerGateway } from "./services/entity-customer/entity-customer.gateway.js"
import { EntityCustomerWorker } from "./services/entity-customer/entity-customer.worker.js"
import { EntityMaterialGateway } from "./services/entity-material/entity-material.gateway.js"
import { EntityMaterialWorker } from "./services/entity-material/entity-material.worker.js"
import { EntityClickhouse } from "./services/entity/entity.clickhouse.js"
import { EntityGateway } from "./services/entity/entity.gateway.js"
import { EntityWorker } from "./services/entity/entity.worker.js"
import { ManufactureGateway } from "./services/manufacture/manufacture.gateway.js"
import { ManufactureWorker } from "./services/manufacture/manufacture.worker.js"
import { MaterialGateway } from "./services/material/material.gateway.js"
import { MaterialWorker } from "./services/material/material.worker.js"
import { OrderCommentGateway } from "./services/order-comments/order-comment.gateway.js"
import { OrderCommentsWorker } from "./services/order-comments/order-comment.worker.js"
import { OrderDroppingGateway } from "./services/order-dropping/order-dropping.gateway.js"
import { OrderDroppingWorker } from "./services/order-dropping/order-dropping.worker.js"
import { OrderItemGateway } from "./services/order-item/order-item.gateway.js"
import { OrderItemWorker } from "./services/order-item/order-item.worker.js"
import { OrderStatusAllocateGateway } from "./services/order-status-allocate/order-status-allocate.gateway.js"
import { OrderStatusAllocateWorker } from "./services/order-status-allocate/order-status-allocate.worker.js"
import { OrderStatusCancelGateway } from "./services/order-status-cancel/order-status-cancel.gateway.js"
import { OrderStatusCancelWorker } from "./services/order-status-cancel/order-status-cancel.worker.js"
import { OrderStatusConfirmGateway } from "./services/order-status-confirm/order-status-confirm.gateway.js"
import { OrderStatusConfirmWorker } from "./services/order-status-confirm/order-status-confirm.worker.js"
import { OrderStatusShippedGateway } from "./services/order-status-shipped/order-status-shipped.gateway.js"
import { OrderStatusShippedWorker } from "./services/order-status-shipped/order-status-shipped.worker.js"
import { OrderGateway } from "./services/order/order.gateway.js"
import { OrderClickhouse } from "./services/order/order.clickhouse.js"
import { OrderWorker } from "./services/order/order.worker.js"
import { SyncExampleWorker } from "./services/sync-example/sync-example.worker.js"
import { TransactionGateway } from "./services/transaction/transaction.gateway.js"
import { TransactionWorker } from "./services/transaction/transaction.worker.js"
import { UserGateway } from "./services/user/user.gateway.js"
import { UserWorker } from "./services/user/user.worker.js"
import { ProgramGateway } from "./services/program/program.gateway.js"
import { ProgramWorker } from "./services/program/program.worker.js"
import { OrderStatusFulfilledGateway } from "./services/order-status-fulfilled/order-fulfilled.gateway.js"
import { OrderStatusFulfilledWorker } from "./services/order-status-fulfilled/order-fullfilled.worker.js"
import { OrderStatusFulfilledRepository } from "./services/order-status-fulfilled/order-fulfilled.repository.js"

const queueName = env.RABBITMQ_QUEUE_NAME ?? "sync-service-queue"
const mq = getConnection
const trxManager = new TransactionManager(db)

const budgetSourceRepository = new BudgetSourceRepository()
const orderStatusFulfilledRepository = new OrderStatusFulfilledRepository()

const sycExampleConsumer = new Consumer(mq, trxManager, queueName)
const syncExampleWorker = new SyncExampleWorker()
syncExampleWorker.registerWorkers(sycExampleConsumer)

const activityConsumer = new Consumer(mq, trxManager, queueName)
const activityGateway = new ActivityGateway()
const activityWorker = new ActivityWorker(activityGateway)
activityWorker.registerWorkers(activityConsumer)

const budgetSourceConsumer = new Consumer(mq, trxManager, queueName)
const budgetSourceGateway = new BudgetSourceGateway(budgetSourceRepository)
const budgetSourceWorker = new BudgetSourceWorker(budgetSourceGateway)
budgetSourceWorker.registerWorkers(budgetSourceConsumer)

const manufactureConsumer = new Consumer(mq, trxManager, queueName)
const manufactureGateway = new ManufactureGateway()
const manufactureWorker = new ManufactureWorker(manufactureGateway)
manufactureWorker.registerWorkers(manufactureConsumer)

const materialConsumer = new Consumer(mq, trxManager, queueName)
const materialGateway = new MaterialGateway()
const materialWorker = new MaterialWorker(materialGateway)
materialWorker.registerWorkers(materialConsumer)

const entityConsumer = new Consumer(mq, trxManager, queueName)
const entityGateway = new EntityGateway()
const entityWorker = new EntityWorker(entityGateway, new EntityClickhouse())
entityWorker.registerWorkers(entityConsumer)

const entityMaterialConsumer = new Consumer(mq, trxManager, queueName)
const entityMaterialGateway = new EntityMaterialGateway()
const entityMaterialWorker = new EntityMaterialWorker(entityMaterialGateway)
entityMaterialWorker.registerWorkers(entityMaterialConsumer)

const entityCustomerConsumer = new Consumer(mq, trxManager, queueName)
const entityCustomerGateway = new EntityCustomerGateway()
const entityCustomerWorker = new EntityCustomerWorker(entityCustomerGateway)
entityCustomerWorker.registerWorkers(entityCustomerConsumer)

const userConsumer = new Consumer(mq, trxManager, queueName)
const userGateway = new UserGateway()
const userWorker = new UserWorker(userGateway)
userWorker.registerWorkers(userConsumer)

// IoTx
const orderClickhouse = new OrderClickhouse()

const orderConsumer = new Consumer(mq, trxManager, queueName)
const orderGateway = new OrderGateway()
const orderWorker = new OrderWorker(orderGateway, orderClickhouse)
orderWorker.registerWorkers(orderConsumer)

const orderDroppingConsumer = new Consumer(mq, trxManager, queueName)
const orderDroppingGateway = new OrderDroppingGateway()
const orderDroppingWorker = new OrderDroppingWorker(
  orderDroppingGateway,
  orderClickhouse
)
orderDroppingWorker.registerWorkers(orderDroppingConsumer)

const trxConsumer = new Consumer(mq, trxManager, queueName)
const trxGateway = new TransactionGateway()
const trxWorker = new TransactionWorker(trxGateway)
trxWorker.registerWorkers(trxConsumer)

const orderCommentConsumer = new Consumer(mq, trxManager, queueName)
const orderCommentGateway = new OrderCommentGateway()
const orderCommentWorker = new OrderCommentsWorker(orderCommentGateway)
orderCommentWorker.registerWorkers(orderCommentConsumer)

const orderItemConsumer = new Consumer(mq, trxManager, queueName)
const orderItemGateway = new OrderItemGateway()
const orderItemWorker = new OrderItemWorker(orderItemGateway, orderClickhouse)
orderItemWorker.registerWorkers(orderItemConsumer)

const orderStatusConfirmConsumer = new Consumer(mq, trxManager, queueName)
const orderStatusConfirmGateway = new OrderStatusConfirmGateway()
const orderStatusConfirmWorker = new OrderStatusConfirmWorker(
  orderStatusConfirmGateway,
  orderClickhouse
)
orderStatusConfirmWorker.registerWorkers(orderStatusConfirmConsumer)

const orderStatusAllocateConsumer = new Consumer(mq, trxManager, queueName)
const orderStatusAllocateGateway = new OrderStatusAllocateGateway()
const orderStatusAllocateWorker = new OrderStatusAllocateWorker(
  orderStatusAllocateGateway,
  orderClickhouse
)
orderStatusAllocateWorker.registerWorkers(orderStatusAllocateConsumer)

const orderStatusShippedConsumer = new Consumer(mq, trxManager, queueName)
const orderStatusShippedGateway = new OrderStatusShippedGateway()
const orderStatusShippedWorker = new OrderStatusShippedWorker(
  orderStatusShippedGateway,
  orderClickhouse
)
orderStatusShippedWorker.registerWorkers(orderStatusShippedConsumer)

const orderStatusCancelConsumer = new Consumer(mq, trxManager, queueName)
const orderStatusCancelGateway = new OrderStatusCancelGateway()
const orderStatusCancelWorker = new OrderStatusCancelWorker(
  orderStatusCancelGateway,
  orderClickhouse
)
orderStatusCancelWorker.registerWorkers(orderStatusCancelConsumer)

const programConsumer = new Consumer(mq, trxManager, queueName)
const programGateway = new ProgramGateway()
const programWorker = new ProgramWorker(programGateway)
programWorker.registerWorkers(programConsumer)

const orderStatusFulfilledConsumer = new Consumer(mq, trxManager, queueName)
const orderStatusFulfilledGateway = new OrderStatusFulfilledGateway(
  orderStatusFulfilledRepository
)
const orderStatusFulfilledWorker = new OrderStatusFulfilledWorker(
  orderStatusFulfilledGateway,
  orderClickhouse
)
orderStatusFulfilledWorker.registerWorkers(orderStatusFulfilledConsumer)

export {
  activityConsumer,
  budgetSourceConsumer,
  entityConsumer,
  entityCustomerConsumer,
  entityMaterialConsumer,
  manufactureConsumer,
  materialConsumer,
  orderCommentConsumer,
  orderConsumer,
  orderDroppingConsumer,
  orderItemConsumer,
  orderStatusAllocateConsumer,
  orderStatusAllocateWorker,
  orderStatusCancelConsumer,
  orderStatusConfirmConsumer,
  orderStatusShippedConsumer,
  sycExampleConsumer,
  trxConsumer,
  userConsumer,
  programConsumer,
  orderStatusFulfilledConsumer,
}
