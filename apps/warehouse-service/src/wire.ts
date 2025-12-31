import { featureFlagsMiddleware } from "@smile/lib"
import { TransactionManager } from "@smile/lib/database.js"
import {
  createRefreshHandler,
  createWebhookHandler,
} from "@smile/lib/feature-flags/webhook.js"
import i18n, { loadResources } from "@smile/lib/i18n.js"
import { RequestMiddleware } from "@smile/lib/middlewares/request.middleware.js"
import { TransactionMiddleware } from "@smile/lib/middlewares/transaction.middleware.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { middlewareTracer, routeTracer } from "@smile/lib/tracing.js"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { db } from "./common/infrastructure/database/index.js"
import { UserActivityWorker } from "./modules/user-activity/user-activity.worker.js"
import { getConnection } from "./common/infrastructure/mq/index.js"
import { AuthKeycloakMiddleware } from "./common/middlewares/auth.middleware.js"
import { CommonMiddleware } from "./common/middlewares/common.middleware.js"
import { ExcelMiddleware } from "./common/middlewares/excel.middleware.js"
import { RoleMiddleware } from "./common/middlewares/role-validation.middleware.js"
import { QueryParamDateRangeValidator } from "./common/validators/query-param-date-range.validator.js"
import { ActivityQuery } from "./modules/activity/activity.query.js"
import { ActivityRepository } from "./modules/activity/activity.repository.js"
import { ConsumptionSupplyController } from "./modules/consumption-supply/consumption-supply.controller.js"
import { ConsumptionSupplyExcel } from "./modules/consumption-supply/consumption-supply.excel.js"
import { ConsumptionSupplyModule } from "./modules/consumption-supply/consumption-supply.module.js"
import { ConsumptionSupplyQuery } from "./modules/consumption-supply/consumption-supply.query.js"
import { ConsumptionSupplyRepository } from "./modules/consumption-supply/consumption-supply.repository.js"
import { DownloadReportController } from "./modules/download-report/download-report.controller.js"
import { DownloadReportModule } from "./modules/download-report/download-report.module.js"
import { DownloadReportQuery } from "./modules/download-report/download-report.query.js"
import { DownloadReportRepository } from "./modules/download-report/download-report.repository.js"
import { ConsumptionGenerateReport } from "./modules/download-report/generate-report/consumption.generate-report.js"
import { DiscardGenerateReport } from "./modules/download-report/generate-report/discard.generate-report.js"
import { ExpiredMaterialGenerateReport } from "./modules/download-report/generate-report/expired-material.generate-report.js"
import { ReceptionGenerateReport } from "./modules/download-report/generate-report/reception.generate-report.js"
import { StockMaterialGenerateReport } from "./modules/download-report/generate-report/stock-material.generate-report.js"
import { EntityTagQuery } from "./modules/entity-tag/entity-tag.query.js"
import { EntityTagRepository } from "./modules/entity-tag/entity-tag.repository.js"
import { EntityQuery } from "./modules/entity/entity.query.js"
import { EntityRepository } from "./modules/entity/entity.repository.js"
import ExportHistoryRepository from "./modules/export-history/export-history.repository.js"
import { LocationModule } from "./modules/location/location.module.js"
import { MaterialQuery } from "./modules/material/material.query.js"
import { MaterialRepository } from "./modules/material/material.repository.js"
import { MonitoringStockController } from "./modules/monitoring/stock/stock.controller.js"
import { MonitoringStockInTransitQuery } from "./modules/monitoring/stock/stock.intransit.query.js"
import { MonitoringStockMiddleware } from "./modules/monitoring/stock/stock.middleware.js"
import { MonitoringStockModule } from "./modules/monitoring/stock/stock.module.js"
import { MonitoringStockOnHandQuery } from "./modules/monitoring/stock/stock.onhand.query.js"
import { MonitoringStockRepository } from "./modules/monitoring/stock/stock.repository.js"
import { MonitoringTransactionController } from "./modules/monitoring/transaction/transaction.controller.js"
import { MonitoringTransactionMiddleware } from "./modules/monitoring/transaction/transaction.middleware.js"
import { MonitoringTransactionModule } from "./modules/monitoring/transaction/transaction.module.js"
import { MonitoringTransactionQuery } from "./modules/monitoring/transaction/transaction.query.js"
import { MonitoringTransactionRepository } from "./modules/monitoring/transaction/transaction.repository.js"
import { OrderDifferenceController } from "./modules/order-difference/order-difference.controller.js"
import { OrderDifferenceExcel } from "./modules/order-difference/order-difference.excel.js"
import { OrderDifferenceModule } from "./modules/order-difference/order-difference.module.js"
import { OrderDifferenceQuery } from "./modules/order-difference/order-difference.query.js"
import { OrderDifferenceRepository } from "./modules/order-difference/order-difference.repository.js"
import { OrderResponseController } from "./modules/order-response/order-response.controller.js"
import { OrderResponseExcel } from "./modules/order-response/order-response.excel.js"
import { OrderResponseModule } from "./modules/order-response/order-response.module.js"
import { OrderResponseQuery } from "./modules/order-response/order-response.query.js"
import { OrderResponseRepository } from "./modules/order-response/order-response.repository.js"
import { ReconciliationController } from "./modules/reconciliation/reconciliation.controller.js"
import { ReconciliationExcel } from "./modules/reconciliation/reconciliation.excel.js"
import { ReconciliationModule } from "./modules/reconciliation/reconciliation.module.js"
import { ReconciliationQuery } from "./modules/reconciliation/reconciliation.query.js"
import { ReconciliationRepository } from "./modules/reconciliation/reconciliation.repository.js"
import { RegionQuery } from "./modules/region/region.query.js"
import { RegionRepository } from "./modules/region/region.repository.js"
import { StockBookController } from "./modules/stock-book/stock-book.controller.js"
import { StockBookModule } from "./modules/stock-book/stock-book.module.js"
import { StockBookQuery } from "./modules/stock-book/stock-book.query.js"
import { StockBookRepository } from "./modules/stock-book/stock-book.repository.js"
import { StockBookWorker } from "./modules/stock-book/stock-book.worker.js"
import { StockOpnameController } from "./modules/stock-opname/stock-opname.controller.js"
import { StockOpnameModule } from "./modules/stock-opname/stock-opname.module.js"
import { StockOpnameQuery } from "./modules/stock-opname/stock-opname.query.js"
import { StockOpnameRepository } from "./modules/stock-opname/stock-opname.repository.js"
import { StockOpnameWorker } from "./modules/stock-opname/stock-opname.worker.js"
import { TransactionListController } from "./modules/transaction-list/transaction-list.controller.js"
import { TransactionListModule } from "./modules/transaction-list/transaction-list.module.js"
import { TransactionListQuery } from "./modules/transaction-list/transaction-list.query.js"
import { TransactionListRepository } from "./modules/transaction-list/transaction-list.repository.js"
import { UserActivityController } from "./modules/user-activity/user-activity.controller.js"
import { UserActivityMiddleware } from "./modules/user-activity/user-activity.middleware.js"
import { UserActivityModule } from "./modules/user-activity/user-activity.module.js"
import { UserActivityQuery } from "./modules/user-activity/user-activity.query.js"
import { UserActivityRepository } from "./modules/user-activity/user-activity.repository.js"
// Stock Inventory - Shared Infrastructure
import { StockInventoryQuery } from "./modules/stock-inventory/stock-inventory.query.js"
import { StockInventoryRepository } from "./modules/stock-inventory/stock-inventory.repository.js"
// Stock Availability Module
import { StockAvailabilityController } from "./modules/stock-inventory/stock-availability/stock-availability.controller.js"
import { StockAvailabilityExcel } from "./modules/stock-inventory/stock-availability/stock-availability.excel.js"
import { StockAvailabilityModule } from "./modules/stock-inventory/stock-availability/stock-availability.module.js"
// Abnormal Stock Module
import { AbnormalStockController } from "./modules/stock-inventory/abnormal-stock/abnormal-stock.controller.js"
import { AbnormalStockExcel } from "./modules/stock-inventory/abnormal-stock/abnormal-stock.excel.js"
import { AbnormalStockModule } from "./modules/stock-inventory/abnormal-stock/abnormal-stock.module.js"
// Filling Stock Module
import { FillingStockController } from "./modules/stock-inventory/filling-stock/filling-stock.controller.js"
import { FillingStockExcel } from "./modules/stock-inventory/filling-stock/filling-stock.excel.js"
import { FillingStockModule } from "./modules/stock-inventory/filling-stock/filling-stock.module.js"
// Add Remove Discard - Shared Infrastructure
import { AddRemoveDiscardQuery } from "./modules/add-remove-discard/add-remove-discard.query.js"
import { AddRemoveDiscardRepository } from "./modules/add-remove-discard/add-remove-discard.repository.js"
import { TransactionReasonQuery } from "./modules/add-remove-discard/transaction-reason.query.js"
import { TransactionReasonRepository } from "./modules/add-remove-discard/transaction-reason.repository.js"
// Add Remove Stock Module
import { AddRemoveStockController } from "./modules/add-remove-discard/add-remove-stock/add-remove-stock.controller.js"
import { AddRemoveStockExcel } from "./modules/add-remove-discard/add-remove-stock/add-remove-stock.excel.js"
import { AddRemoveStockModule } from "./modules/add-remove-discard/add-remove-stock/add-remove-stock.module.js"
// Stock Discard Module
import { MasterDataRepository } from "./common/repositories/master-data.repository.js"
import { StockDiscardController } from "./modules/add-remove-discard/stock-discard/stock-discard.controller.js"
import { StockDiscardExcel } from "./modules/add-remove-discard/stock-discard/stock-discard.excel.js"
import { StockDiscardModule } from "./modules/add-remove-discard/stock-discard/stock-discard.module.js"
// Periodic Material Stock Module
import { PeriodicMaterialStockController } from "./modules/periodic-material-stock/periodic-material-stock.controller.js"
import { PeriodicMaterialStockExcel } from "./modules/periodic-material-stock/periodic-material-stock.excel.js"
import { PeriodicMaterialStockModule } from "./modules/periodic-material-stock/periodic-material-stock.module.js"
import { PeriodicMaterialStockQuery } from "./modules/periodic-material-stock/periodic-material-stock.query.js"
import { PeriodicMaterialStockRepository } from "./modules/periodic-material-stock/periodic-material-stock.repository.js"
import { PeriodicMaterialStockWorker } from "./modules/periodic-material-stock/periodic-material-stock.worker.js"
// Inventory Overview Module
import { InventoryOverviewController } from "./modules/inventory-overview/inventory-overview.controller.js"
import { InventoryOverviewModule } from "./modules/inventory-overview/inventory-overview.module.js"
import { InventoryOverviewQuery } from "./modules/inventory-overview/inventory-overview.query.js"
import { InventoryOverviewRepository } from "./modules/inventory-overview/inventory-overview.repository.js"
// Smile vs ASIK Module
import { SmileVsAsikQuery } from "./modules/smile-vs-asik/smile-vs-asik.query.js"
import { SmileVsAsikRepository } from "./modules/smile-vs-asik/smile-vs-asik.repository.js"
import { SmileVsAsikExcel } from "./modules/smile-vs-asik/smile-vs-asik.excel.js"
import { SmileVsAsikModule } from "./modules/smile-vs-asik/smile-vs-asik.module.js"
import { SmileVsAsikController } from "./modules/smile-vs-asik/smile-vs-asik.controller.js"
import { LplpoController } from "./modules/lplpo/lplpo.controller.js"
import { LplpoModule } from "./modules/lplpo/lplpo.module.js"
import { LplpoRepository } from "./modules/lplpo/lplpo.repository.js"

import { AssetInventoryController } from "./modules/asset-inventory/asset-inventory.controller.js"
import { AssetInventoryExcel } from "./modules/asset-inventory/asset-inventory.excel.js"
import { AssetInventoryModule } from "./modules/asset-inventory/asset-inventory.module.js"
import { AssetInventoryQuery } from "./modules/asset-inventory/asset-inventory.query.js"
import { AssetInventoryRepository } from "./modules/asset-inventory/asset-inventory.repository.js"

// Asset Monitoring Device Module
import { AssetMonitoringDeviceController } from "./modules/asset-monitoring-device/asset-monitoring-device.controller.js"
import { AssetMonitoringDeviceExcel } from "./modules/asset-monitoring-device/asset-monitoring-device.excel.js"
import { AssetMonitoringDeviceModule } from "./modules/asset-monitoring-device/asset-monitoring-device.module.js"
import { AssetMonitoringDeviceQuery } from "./modules/asset-monitoring-device/asset-monitoring-device.query.js"
import { AssetMonitoringDeviceRepository } from "./modules/asset-monitoring-device/asset-monitoring-device.repository.js"

import { LplpoWorker } from "./modules/lplpo/lplpo.worker.js"
import { StockAvailabilityGenerateReport } from "./modules/download-report/generate-report/stock-availability.generate-report.js"
import { LoggerMonitoringGenerateReport } from "./modules/download-report/generate-report/logger-monitoring.generate-report.js"
import { LoggerMonitoringRepository } from "./modules/logger-monitoring/logger-monitoring.repository.js"
import { LoggerMonitoringQuery } from "./modules/logger-monitoring/logger-monitoring.query.js"

/* Shared Dependencies */
const queryParamDateRangeValidator = new QueryParamDateRangeValidator()
const trxManager = new TransactionManager(db)
const trxMiddleware = new TransactionMiddleware(trxManager)
const mq = getConnection
const publisher = new Publisher(mq)

const commonMiddleware = new CommonMiddleware()
const authKeycloakMiddleware = new AuthKeycloakMiddleware()
const requestMiddleware = new RequestMiddleware()
const roleMiddleware = new RoleMiddleware()
const excelMiddleware = new ExcelMiddleware()

const masterDataRepo = new MasterDataRepository()

const materialQuery = new MaterialQuery()
const materialRepo = new MaterialRepository(materialQuery)

const regionQuery = new RegionQuery()
const regionRepo = new RegionRepository(regionQuery)
const entityQuery = new EntityQuery()
const entityRepo = new EntityRepository(entityQuery)
const entityTagQuery = new EntityTagQuery()
const entityTagRepo = new EntityTagRepository(entityTagQuery)
const activityQuery = new ActivityQuery()
const activityRepo = new ActivityRepository(activityQuery)
const locationModule = new LocationModule(regionRepo, entityRepo)

const exportHistoryRepo = new ExportHistoryRepository()

const stockInventoryQuery = new StockInventoryQuery()
const stockInventoryRepository = new StockInventoryRepository(
  stockInventoryQuery
)

/* Inject Dependencies */
// Monitoring Stock
const monitoringStockOnHandQuery = new MonitoringStockOnHandQuery()
const monitoringStockInTransitQuery = new MonitoringStockInTransitQuery()
const monitoringStockRepo = new MonitoringStockRepository(
  monitoringStockOnHandQuery,
  monitoringStockInTransitQuery
)
const monitoringStockModule = new MonitoringStockModule(monitoringStockRepo)
const monitoringStockMiddleware = new MonitoringStockMiddleware(
  queryParamDateRangeValidator,
  activityRepo
)
const monitoringStockController = new MonitoringStockController(
  monitoringStockModule,
  monitoringStockMiddleware,
  roleMiddleware,
  excelMiddleware
)

// Monitoring Transaction
const monitoringTransactionQuery = new MonitoringTransactionQuery()
const monitoringTransactionRepo = new MonitoringTransactionRepository(
  monitoringTransactionQuery
)
const monitoringTransactionModule = new MonitoringTransactionModule(
  monitoringTransactionRepo,
  entityTagRepo,
  entityRepo
)
const monitoringTransactionMiddleware = new MonitoringTransactionMiddleware(
  queryParamDateRangeValidator,
  monitoringTransactionRepo
)
const monitoringTransactionController = new MonitoringTransactionController(
  monitoringTransactionModule,
  monitoringTransactionMiddleware,
  roleMiddleware
)

// User Activity
const userActivityQuery = new UserActivityQuery()
const userActivityRepo = new UserActivityRepository(userActivityQuery)
const userActivityModule = new UserActivityModule(
  userActivityRepo,
  materialRepo,
  exportHistoryRepo,
  publisher
)
const userActivityWorker = new UserActivityWorker(
  userActivityModule,
  exportHistoryRepo,
  materialRepo
)
const userActivityConsumer = new Consumer(mq, trxManager)
userActivityWorker.registerWorkers(userActivityConsumer)

const userActivityMiddleware = new UserActivityMiddleware(
  queryParamDateRangeValidator
)
const userActivityController = new UserActivityController(
  userActivityModule,
  userActivityMiddleware,
  roleMiddleware
)

// Stock Opname
const stockOpnameQuery = new StockOpnameQuery()
const stockOpnameRepo = new StockOpnameRepository(stockOpnameQuery)
const stockOpnameModule = new StockOpnameModule(
  stockOpnameRepo,
  materialRepo,
  entityRepo,
  entityTagRepo,
  regionRepo,
  activityRepo,
  locationModule,
  exportHistoryRepo,
  publisher
)
const stockOpnameController = new StockOpnameController(
  stockOpnameModule,
  roleMiddleware
)
const stockOpnameWorker = new StockOpnameWorker(
  stockOpnameModule,
  exportHistoryRepo
)
const stockOpnameConsumer = new Consumer(mq, trxManager)
stockOpnameWorker.registerWorkers(stockOpnameConsumer)

// Reconciliation
const reconciliationQuery = new ReconciliationQuery()
const reconciliationRepo = new ReconciliationRepository(reconciliationQuery)
const reconciliationExcel = new ReconciliationExcel(
  activityRepo,
  regionRepo,
  entityTagRepo,
  entityRepo
)
const reconciliationModule = new ReconciliationModule(
  reconciliationRepo,
  entityRepo,
  entityTagRepo,
  regionRepo,
  activityRepo,
  reconciliationExcel
)
const reconciliationController = new ReconciliationController(
  reconciliationModule,
  roleMiddleware
)

// Stock Book
const stockBookQuery = new StockBookQuery()
const stockBookRepo = new StockBookRepository(stockBookQuery)
const stockBookModule = new StockBookModule(
  stockBookRepo,
  entityRepo,
  exportHistoryRepo,
  publisher
)
const stockBookController = new StockBookController(
  stockBookModule,
  roleMiddleware
)
const stockBookWorker = new StockBookWorker(
  stockBookRepo,
  entityRepo,
  exportHistoryRepo
)
const stockBookConsumer = new Consumer(mq, trxManager)
stockBookWorker.registerWorkers(stockBookConsumer)

// Transaction List
const transactionListQuery = new TransactionListQuery()
const transactionListRepo = new TransactionListRepository(transactionListQuery)
const transactionListModule = new TransactionListModule(transactionListRepo)
const transactionListController = new TransactionListController(
  transactionListModule,
  roleMiddleware
)

// Download Report
const downloadReportQuery = new DownloadReportQuery()
const downloadReportRepo = new DownloadReportRepository(downloadReportQuery)
// generate report
const receptionGenerateReport = new ReceptionGenerateReport(downloadReportRepo)
const stockMaterialGenerateReport = new StockMaterialGenerateReport(
  downloadReportRepo
)
const consumptionGenerateReport = new ConsumptionGenerateReport(
  downloadReportRepo
)
const discardGenerateReport = new DiscardGenerateReport(downloadReportRepo)
const expiredMaterialGenerateReport = new ExpiredMaterialGenerateReport(
  downloadReportRepo
)
const loggerMonitoringQuery = new LoggerMonitoringQuery()
const loggerMonitoringRepo = new LoggerMonitoringRepository(
  loggerMonitoringQuery
)
const loggerMonitoringGenerateReport = new LoggerMonitoringGenerateReport(
  loggerMonitoringRepo
)

// Consumption Supply
const consumptionSupplyQuery = new ConsumptionSupplyQuery()
const consumptionSupplyRepo = new ConsumptionSupplyRepository(
  consumptionSupplyQuery
)
const consumptionSupplyExcel = new ConsumptionSupplyExcel(
  activityRepo,
  regionRepo,
  entityTagRepo,
  entityRepo,
  materialRepo
)
const consumptionSupplyModule = new ConsumptionSupplyModule(
  consumptionSupplyRepo,
  materialRepo,
  entityRepo,
  locationModule,
  activityRepo,
  regionRepo,
  entityTagRepo,
  consumptionSupplyExcel
)
const consumptionSupplyController = new ConsumptionSupplyController(
  consumptionSupplyModule,
  roleMiddleware
)

// Order Difference Module
const orderDifferenceQuery = new OrderDifferenceQuery()
const orderDifferenceRepository = new OrderDifferenceRepository(
  orderDifferenceQuery
)
const orderDifferenceExcel = new OrderDifferenceExcel(
  activityRepo,
  regionRepo,
  entityTagRepo,
  entityRepo,
  materialRepo
)
const orderDifferenceModule = new OrderDifferenceModule(
  orderDifferenceRepository,
  materialRepo,
  entityRepo,
  locationModule,
  activityRepo,
  regionRepo,
  entityTagRepo,
  orderDifferenceExcel
)
const orderDifferenceController = new OrderDifferenceController(
  orderDifferenceModule,
  roleMiddleware
)

// Order Response Module
const orderResponseQuery = new OrderResponseQuery()
const orderResponseRepository = new OrderResponseRepository(orderResponseQuery)
const orderResponseExcel = new OrderResponseExcel(
  activityRepo,
  regionRepo,
  entityTagRepo,
  entityRepo,
  materialRepo
)
const orderResponseModule = new OrderResponseModule(
  orderResponseRepository,
  materialRepo,
  entityRepo,
  locationModule,
  activityRepo,
  regionRepo,
  entityTagRepo,
  orderResponseExcel
)
const orderResponseController = new OrderResponseController(
  orderResponseModule,
  roleMiddleware
)

// Stock Availability Module
const stockAvailabilityExcel = new StockAvailabilityExcel(
  materialRepo,
  entityRepo,
  entityTagRepo,
  regionRepo
)
const stockAvailabilityModule = new StockAvailabilityModule(
  stockInventoryRepository,
  materialRepo,
  entityRepo,
  locationModule,
  stockAvailabilityExcel
)
const stockAvailabilityController = new StockAvailabilityController(
  stockAvailabilityModule,
  roleMiddleware
)

// Abnormal Stock Module
const abnormalStockExcel = new AbnormalStockExcel(
  materialRepo,
  entityRepo,
  entityTagRepo,
  regionRepo
)
const abnormalStockModule = new AbnormalStockModule(
  stockInventoryRepository,
  materialRepo,
  entityRepo,
  regionRepo,
  locationModule,
  abnormalStockExcel
)

const stockAvailabilityGenerateReport = new StockAvailabilityGenerateReport(
  abnormalStockModule,
  stockAvailabilityModule
)

const downloadReportModule = new DownloadReportModule(
  downloadReportRepo,
  receptionGenerateReport,
  stockMaterialGenerateReport,
  consumptionGenerateReport,
  discardGenerateReport,
  expiredMaterialGenerateReport,
  stockAvailabilityGenerateReport,
  loggerMonitoringGenerateReport
)
const downloadReportController = new DownloadReportController(
  downloadReportModule,
  roleMiddleware
)
const abnormalStockController = new AbnormalStockController(
  abnormalStockModule,
  roleMiddleware
)

// Filling Stock Module
const fillingStockExcel = new FillingStockExcel(
  materialRepo,
  entityRepo,
  entityTagRepo,
  regionRepo
)
const fillingStockModule = new FillingStockModule(
  stockInventoryRepository,
  materialRepo,
  entityRepo,
  regionRepo,
  locationModule,
  fillingStockExcel
)
const fillingStockController = new FillingStockController(
  fillingStockModule,
  roleMiddleware
)

// Add Remove Discard - Shared Infrastructure
const addRemoveDiscardQuery = new AddRemoveDiscardQuery()
const transactionReasonQuery = new TransactionReasonQuery()
const transactionReasonRepository = new TransactionReasonRepository(
  transactionReasonQuery
)
const addRemoveDiscardRepository = new AddRemoveDiscardRepository(
  addRemoveDiscardQuery
)

// Add Remove Stock Module
const addRemoveStockExcel = new AddRemoveStockExcel()
const addRemoveStockModule = new AddRemoveStockModule(
  addRemoveDiscardRepository,
  transactionReasonRepository,
  materialRepo,
  entityRepo,
  locationModule,
  addRemoveStockExcel
)
const addRemoveStockController = new AddRemoveStockController(
  addRemoveStockModule,
  roleMiddleware
)

// Stock Discard Module
const stockDiscardExcel = new StockDiscardExcel()
const stockDiscardModule = new StockDiscardModule(
  addRemoveDiscardRepository,
  transactionReasonRepository,
  materialRepo,
  entityRepo,
  locationModule,
  stockDiscardExcel
)
const stockDiscardController = new StockDiscardController(
  stockDiscardModule,
  roleMiddleware
)

// Periodic Material Stock Module
const periodicMaterialStockQuery = new PeriodicMaterialStockQuery()
const periodicMaterialStockRepository = new PeriodicMaterialStockRepository(
  periodicMaterialStockQuery
)
const periodicMaterialStockExcel = new PeriodicMaterialStockExcel(
  activityRepo,
  entityRepo,
  materialRepo
)
const periodicMaterialStockModule = new PeriodicMaterialStockModule(
  periodicMaterialStockRepository,
  materialRepo,
  entityRepo,
  periodicMaterialStockExcel,
  exportHistoryRepo,
  publisher
)
const periodicMaterialStockController = new PeriodicMaterialStockController(
  periodicMaterialStockModule,
  roleMiddleware
)
const periodicMaterialStockWorker = new PeriodicMaterialStockWorker(
  periodicMaterialStockRepository,
  materialRepo,
  entityRepo,
  activityRepo,
  exportHistoryRepo
)
const periodicMaterialStockConsumer = new Consumer(mq, trxManager)
periodicMaterialStockWorker.registerWorkers(periodicMaterialStockConsumer)

// Inventory Overview Module
const inventoryOverviewQuery = new InventoryOverviewQuery()
const inventoryOverviewRepository = new InventoryOverviewRepository(
  inventoryOverviewQuery
)
const inventoryOverviewModule = new InventoryOverviewModule(
  inventoryOverviewRepository,
  regionRepo,
  entityRepo,
  locationModule
)
const inventoryOverviewController = new InventoryOverviewController(
  inventoryOverviewModule,
  roleMiddleware
)

// Asset Inventory
const assetInventoryQuery = new AssetInventoryQuery()
const assetInventoryRepository = new AssetInventoryRepository(
  assetInventoryQuery
)
const assetInventoryModule = new AssetInventoryModule(
  assetInventoryRepository,
  masterDataRepo,
  new AssetInventoryExcel(regionRepo, entityTagRepo, masterDataRepo)
)
const assetInventoryController = new AssetInventoryController(
  assetInventoryModule,
  roleMiddleware
)

// Asset Monitoring Device
const assetMonitoringDeviceQuery = new AssetMonitoringDeviceQuery()
const assetMonitoringDeviceRepository = new AssetMonitoringDeviceRepository(
  assetMonitoringDeviceQuery
)
const assetMonitoringDeviceExcel = new AssetMonitoringDeviceExcel()
const assetMonitoringDeviceModule = new AssetMonitoringDeviceModule(
  assetMonitoringDeviceRepository,
  assetMonitoringDeviceExcel
)
const assetMonitoringDeviceController = new AssetMonitoringDeviceController(
  assetMonitoringDeviceModule,
  roleMiddleware
)

// Smile vs ASIK Module
const smileVsAsikQuery = new SmileVsAsikQuery()
const smileVsAsikRepository = new SmileVsAsikRepository(smileVsAsikQuery)
const smileVsAsikExcel = new SmileVsAsikExcel(
  activityRepo,
  regionRepo,
  entityTagRepo,
  materialRepo
)
const smileVsAsikModule = new SmileVsAsikModule(
  smileVsAsikRepository,
  locationModule,
  smileVsAsikExcel
)
const smileVsAsikController = new SmileVsAsikController(
  smileVsAsikModule,
  roleMiddleware
)

/* Main App */
const warehouseApp = new Hono()
warehouseApp.use(cors())
warehouseApp.use(
  "*",
  middlewareTracer.traceMiddleware("loadSlaveDB"),
  commonMiddleware.loadSlaveDB
)
warehouseApp.use(
  "*",
  middlewareTracer.traceMiddleware("loadElasticClient"),
  commonMiddleware.loadElasticClient
)
warehouseApp.use(
  "*",
  middlewareTracer.traceMiddleware("requestMiddleware"),
  requestMiddleware.handle
)
warehouseApp.use(
  "*",
  middlewareTracer.traceMiddleware("authKeycloakMiddleware"),
  authKeycloakMiddleware.handleAuthKeycloak
)
warehouseApp.use(
  "*",
  middlewareTracer.traceMiddleware("featureFlagsMiddleware"),
  featureFlagsMiddleware()
)
warehouseApp.use(
  "*",
  middlewareTracer.traceMiddleware("trxMiddleware"),
  trxMiddleware.handle
)

/* Register Routes */
const monitoringStockRoutes = new Hono()
monitoringStockRoutes.use("*", routeTracer.traceRoute("monitoring-stock"))
monitoringStockRoutes.route("/", monitoringStockController.getRoutes())
warehouseApp.route("/monitoring/stock", monitoringStockRoutes)

const monitoringTransactionRoutes = new Hono()
monitoringTransactionRoutes.use(
  "*",
  routeTracer.traceRoute("monitoring-transaction")
)
monitoringTransactionRoutes.route(
  "/",
  monitoringTransactionController.getRoutes()
)
warehouseApp.route("/monitoring/transaction", monitoringTransactionRoutes)

const userActivityRoutes = new Hono()
userActivityRoutes.use("*", routeTracer.traceRoute("user-activity"))
userActivityRoutes.route("/", userActivityController.getRoutes())
warehouseApp.route("/activity", userActivityRoutes)

const stockOpnameRoutes = new Hono()
stockOpnameRoutes.use("*", routeTracer.traceRoute("stock-opname"))
stockOpnameRoutes.route("/", stockOpnameController.getRoutes())
warehouseApp.route("/stock-opname", stockOpnameRoutes)

const reconciliationRoutes = new Hono()
reconciliationRoutes.use("*", routeTracer.traceRoute("reconciliation"))
reconciliationRoutes.route("/", reconciliationController.getRoutes())
warehouseApp.route("/reconciliation", reconciliationRoutes)

const stockBookRoutes = new Hono()
stockBookRoutes.use("*", routeTracer.traceRoute("stock-book"))
stockBookRoutes.route("/", stockBookController.getRoutes())
warehouseApp.route("/stock-book", stockBookRoutes)

const transactionListRoutes = new Hono()
transactionListRoutes.use("*", routeTracer.traceRoute("transaction-list"))
transactionListRoutes.route("/", transactionListController.getRoutes())
warehouseApp.route("/transaction-list", transactionListRoutes)

const downloadReportRoutes = new Hono()
downloadReportRoutes.use("*", routeTracer.traceRoute("download-report"))
downloadReportRoutes.route("/", downloadReportController.getRoutes())
warehouseApp.route("/download", downloadReportRoutes)

const consumptionSupplyRoutes = new Hono()
consumptionSupplyRoutes.use("*", routeTracer.traceRoute("consumption-supply"))
consumptionSupplyRoutes.route("/", consumptionSupplyController.getRoutes())
warehouseApp.route("/consumption-supply", consumptionSupplyRoutes)

const orderDifferenceRoutes = new Hono()
orderDifferenceRoutes.use("*", routeTracer.traceRoute("order-difference"))
orderDifferenceRoutes.route("/", orderDifferenceController.getRoutes())
warehouseApp.route("/order-difference", orderDifferenceRoutes)

const orderResponseRoutes = new Hono()
orderResponseRoutes.use("*", routeTracer.traceRoute("order-response"))
orderResponseRoutes.route("/", orderResponseController.getRoutes())
warehouseApp.route("/order-response", orderResponseRoutes)

const stockAvailabilityRoutes = new Hono()
stockAvailabilityRoutes.use("*", routeTracer.traceRoute("stock-availability"))
stockAvailabilityRoutes.route("/", stockAvailabilityController.getRoutes())
warehouseApp.route("/stock-availability", stockAvailabilityRoutes)

const abnormalStockRoutes = new Hono()
abnormalStockRoutes.use("*", routeTracer.traceRoute("abnormal-stock"))
abnormalStockRoutes.route("/", abnormalStockController.getRoutes())
warehouseApp.route("/abnormal-stock", abnormalStockRoutes)

const fillingStockRoutes = new Hono()
fillingStockRoutes.use("*", routeTracer.traceRoute("filling-stock"))
fillingStockRoutes.route("/", fillingStockController.getRoutes())
warehouseApp.route("/filling-stock", fillingStockRoutes)

const addRemoveStockRoutes = new Hono()
addRemoveStockRoutes.use("*", routeTracer.traceRoute("add-remove-stock"))
addRemoveStockRoutes.route("/", addRemoveStockController.getRoutes())
warehouseApp.route("/add-remove-stock", addRemoveStockRoutes)

const stockDiscardRoutes = new Hono()
stockDiscardRoutes.use("*", routeTracer.traceRoute("stock-discard"))
stockDiscardRoutes.route("/", stockDiscardController.getRoutes())
warehouseApp.route("/stock-discard", stockDiscardRoutes)

const periodicMaterialStockRoutes = new Hono()
periodicMaterialStockRoutes.use(
  "*",
  routeTracer.traceRoute("periodic-material-stock")
)
periodicMaterialStockRoutes.route(
  "/",
  periodicMaterialStockController.getRoutes()
)
warehouseApp.route("/periodic-material-stock", periodicMaterialStockRoutes)

const inventoryOverviewRoutes = new Hono()
inventoryOverviewRoutes.use("*", routeTracer.traceRoute("inventory-overview"))
inventoryOverviewRoutes.route("/", inventoryOverviewController.getRoutes())
warehouseApp.route("/inventory", inventoryOverviewRoutes)

const assetInventoryRoutes = new Hono()
assetInventoryRoutes.use("*", routeTracer.traceRoute("asset-inventory"))
assetInventoryRoutes.route("/", assetInventoryController.getRoutes())
warehouseApp.route("/asset-inventory", assetInventoryRoutes)

const assetMonitoringDeviceRoutes = new Hono()
assetMonitoringDeviceRoutes.use(
  "*",
  routeTracer.traceRoute("asset-monitoring-device")
)
assetMonitoringDeviceRoutes.route(
  "/",
  assetMonitoringDeviceController.getRoutes()
)
warehouseApp.route("/asset-monitoring-device", assetMonitoringDeviceRoutes)

const smileVsAsikRoutes = new Hono()
smileVsAsikRoutes.use("*", routeTracer.traceRoute("smile-vs-asik"))
smileVsAsikRoutes.route("/", smileVsAsikController.getRoutes())
warehouseApp.route("/asik", smileVsAsikRoutes)

// Feature flags webhook routes (public - bypasses auth for external webhooks)
const featureFlagsWebhookRoutes = new Hono()
featureFlagsWebhookRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("loadSlaveDB"),
  commonMiddleware.loadSlaveDB
)
featureFlagsWebhookRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("loadElasticClient"),
  commonMiddleware.loadElasticClient
)
featureFlagsWebhookRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("requestMiddleware"),
  requestMiddleware.handle
)
featureFlagsWebhookRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("feature-flags-webhook"),
  routeTracer.traceRoute("feature-flags-webhook")
)
featureFlagsWebhookRoutes.post("/webhook", createWebhookHandler())
featureFlagsWebhookRoutes.post("/refresh", createRefreshHandler())
warehouseApp.route("/feature-flags", featureFlagsWebhookRoutes)

const lplpoModule = new LplpoModule(
  new LplpoRepository(),
  exportHistoryRepo,
  publisher
)

const lplpoController = new LplpoController(
  lplpoModule,
  roleMiddleware
  // roleMiddleware
)

const lplpoWorker = new LplpoWorker(lplpoModule, exportHistoryRepo)
const lplpoConsumer = new Consumer(mq, trxManager)
lplpoWorker.registerWorkers(lplpoConsumer)

const lplpoRoutes = new Hono()
lplpoRoutes.use("*", routeTracer.traceRoute("report"))
lplpoRoutes.route("/", lplpoController.getRoutes())
warehouseApp.route("/report", lplpoRoutes)

// Testing tolgee translation
warehouseApp.get("/tolgee/:key", async (c) => {
  i18n.loadResources(await loadResources())
  const key = c.req.param("key") ?? ""
  const value = c.var.t(key)

  return c.json({ value }, 200)
})

export {
  periodicMaterialStockConsumer,
  stockBookConsumer,
  stockOpnameConsumer,
  warehouseApp,
  lplpoConsumer,
  userActivityConsumer,
}
