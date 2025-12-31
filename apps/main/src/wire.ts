import { db } from "@/common/infrastructure/database/index.js"
import { UserController } from "@/modules/user/user.controller.js"
import { UserModule } from "@/modules/user/user.module.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { AuthKeycloakService } from "@smile/lib/api/auth.service.js"
import { TransactionManager } from "@smile/lib/database.js"
import { featureFlagsMiddleware } from "@smile/lib/feature-flags/middleware.js"
import { featureGuardMiddleware } from "./common/middlewares/feature-guard.middleware.js"
import {
  createRefreshHandler,
  createWebhookHandler,
} from "@smile/lib/feature-flags/webhook.js"
import i18n, { loadResources, reloadTranslations } from "@smile/lib/i18n.js"
import { EventMiddleware } from "@smile/lib/middlewares/event.middleware.js"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"
import { RequestMiddleware } from "@smile/lib/middlewares/request.middleware.js"
import { TransactionMiddleware } from "@smile/lib/middlewares/transaction.middleware.js"
import { Consumer } from "@smile/lib/rabbitmq/consumer.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { middlewareTracer, routeTracer } from "@smile/lib/tracing.js"
import { randomUUID } from "crypto"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { env } from "process"
import { getConnection } from "./common/infrastructure/mq/index.js"
import {
  AuthKeycloakMiddleware,
  AuthMiddleware,
} from "./common/middlewares/auth.middleware.js"
import { CommonMiddleware } from "./common/middlewares/common.middleware.js"
import { DeduplicationMiddleware } from "./common/middlewares/dedup.middleware.js"
import { RoleMiddleware } from "./common/middlewares/role-validation.middleware.js"
import { NotificationTypeRepository } from "./common/repository/notification-type.js"
import { RolesToResourceMappingRepository } from "./common/repository/roles.repository.js"
import { ActivityController } from "./modules/activity/activity.controller.js"
import { ActivityMiddleware } from "./modules/activity/activity.middleware.js"
import { ActivityModule } from "./modules/activity/activity.module.js"
import { ActivityPublisher } from "./modules/activity/activity.publisher.js"
import { ActivityRepository } from "./modules/activity/activity.repository.js"
import { AnnualCommitmentController } from "./modules/annual-commitment/annual-commitment.controller.js"
import { AnnualCommitmentMiddleware } from "./modules/annual-commitment/annual-commitment.middleware.js"
import { AnnualCommitmentModule } from "./modules/annual-commitment/annual-commitment.module.js"
import { AnnualCommitmentRepository } from "./modules/annual-commitment/annual-commitment.repository.js"
import { AnnualNeedController } from "./modules/annual-needs/annual-needs.controller.js"
import { AnnualNeedMiddleware } from "./modules/annual-needs/annual-needs.middleware.js"
import { AnnualNeedModule } from "./modules/annual-needs/annual-needs.module.js"
import { AnnualNeedRepository } from "./modules/annual-needs/annual-needs.repository.js"
import { AnnualPlanningGroupTargetController } from "./modules/annual-planning-group-target/annual-planning-group-target.controller.js"
import { AnnualPlanningGroupTargetMiddleware } from "./modules/annual-planning-group-target/annual-planning-group-target.middleware.js"
import { AnnualPlanningGroupTargetModule } from "./modules/annual-planning-group-target/annual-planning-group-target.module.js"
import { AnnualPlanningGroupTargetRepository } from "./modules/annual-planning-group-target/annual-planning-group-target.repository.js"
import { AnnualPlanningMaterialSubstitutionController } from "./modules/annual-planning-material-substitution/annual-planning-material-substitution.controller.js"
import { AnnualPlanningMaterialSubstitutionModule } from "./modules/annual-planning-material-substitution/annual-planning-material-substitution.module.js"
import { AnnualPlanningMaterialSubstitutionRepository } from "./modules/annual-planning-material-substitution/annual-planning-material-substitution.repository.js"
import { AnnualPlanningMaterialSubstitutionMiddleware } from "./modules/annual-planning-material-substitution/annual-planning-material-susbstitution.middleware.js"
import { AnnualPlanningProgramPlanController } from "./modules/annual-planning-program-plan/annual-planning-program-plan.controller.js"
import { AnnualPlanningProgramPlanMiddleware } from "./modules/annual-planning-program-plan/annual-planning-program-plan.middleware.js"
import { AnnualPlanningProgramPlanModule } from "./modules/annual-planning-program-plan/annual-planning-program-plan.module.js"
import { AnnualPlanningProgramPlanRepository } from "./modules/annual-planning-program-plan/annual-planning-program-plan.repository.js"
import { AppMobileDataController } from "./modules/app-mobile-data/app-mobile-data.controller.js"
import { AppMobileDataModule } from "./modules/app-mobile-data/app-mobile-data.module.js"
import { AppMobileNotifController } from "./modules/app-mobile-notif/app-mobile-notif.controller.js"
import { AppMobileNotifModule } from "./modules/app-mobile-notif/app-mobile-notif.module.js"
import { AppMobileNotifRepository } from "./modules/app-mobile-notif/app-mobile-notif.repository.js"
import { AssetCalibrationScheduleController } from "./modules/asset-calibration-schedule/asset-calibration-schedule.controller.js"
import { AssetCalibrationScheduleModule } from "./modules/asset-calibration-schedule/asset-calibration-schedule.module.js"
import { AssetCalibrationScheduleRepository } from "./modules/asset-calibration-schedule/asset-calibration-schedule.repository.js"
import { AssetElectricityController } from "./modules/asset-electricity/asset-electricity.controller.js"
import { AssetElectricityModule } from "./modules/asset-electricity/asset-electricity.module.js"
import { AssetElectricityRepository } from "./modules/asset-electricity/asset-electricity.repository.js"
import { AssetInventoryController } from "./modules/asset-inventory/asset-inventory.controller.js"
import { AssetInventoryMiddleware } from "./modules/asset-inventory/asset-inventory.middleware.js"
import { AssetInventoryModule } from "./modules/asset-inventory/asset-inventory.module.js"
import { AssetInventoryRepository } from "./modules/asset-inventory/asset-inventory.repository.js"
import { AssetMaintenanceScheduleController } from "./modules/asset-maintenance-schedule/asset-maintenance-schedule.controller.js"
import { AssetMaintenanceScheduleModule } from "./modules/asset-maintenance-schedule/asset-maintenance-schedule.module.js"
import { AssetMaintenanceScheduleRepository } from "./modules/asset-maintenance-schedule/asset-maintenance-schedule.repository.js"
import { AssetModelController } from "./modules/asset-model/asset-model.controller.js"
import { AssetModelMiddleware } from "./modules/asset-model/asset-model.middleware.js"
import { AssetModelModule } from "./modules/asset-model/asset-model.module.js"
import { AssetModelRepository } from "./modules/asset-model/asset-model.repository.js"
import { AssetTypeController } from "./modules/asset-type/asset-type.controller.js"
import { AssetTypeMiddleware } from "./modules/asset-type/asset-type.middleware.js"
import { AssetTypeModule } from "./modules/asset-type/asset-type.module.js"
import { AssetTypeRepository } from "./modules/asset-type/asset-type.repository.js"
import { AssetVendorController } from "./modules/asset-vendor/asset-vendor.controller.js"
import { AssetVendorMiddleware } from "./modules/asset-vendor/asset-vendor.middleware.js"
import { AssetVendorModule } from "./modules/asset-vendor/asset-vendor.module.js"
import { AssetVendorRepository } from "./modules/asset-vendor/asset-vendor.repository.js"
import { AssetWorkingStatusController } from "./modules/asset-working-status/asset-working-status.controller.js"
import { AssetWorkingStatusModule } from "./modules/asset-working-status/asset-working-status.module.js"
import { AssetWorkingStatusRepository } from "./modules/asset-working-status/asset-working-status.repository.js"
import { OrderDroppingPublisher } from "./modules/base.order-dropping.publisher.js"
import { BatchController } from "./modules/batch/batch.controller.js"
import { BatchModule } from "./modules/batch/batch.module.js"
import { BatchRepository } from "./modules/batch/batch.repository.js"
import { BiasImmunizationLogisticsController } from "./modules/bias-immunization-logistics/bias-immunization-logistics.controller.js"
import { BiasImmunizationLogisticsModule } from "./modules/bias-immunization-logistics/bias-immunization-logistics.module.js"
import { BiasImmunizationLogisticsRepository } from "./modules/bias-immunization-logistics/bias-immunization-logistics.repository.js"
import { BudgetSourceController } from "./modules/budget-source/budget-source.controller.js"
import { BudgetSourceMiddleware } from "./modules/budget-source/budget-source.middleware.js"
import { BudgetSourceModule } from "./modules/budget-source/budget-source.module.js"
import { BudgetSourceRepository } from "./modules/budget-source/budget-source.repository.js"
import { ContractController } from "./modules/contracts/contract.controller.js"
import { ContractModule } from "./modules/contracts/contract.module.js"
import { ContractRepository } from "./modules/contracts/contract.repository.js"
import { DengueCaseController } from "./modules/dengue/dengue-case/dengue-case.controller.js"
import { DengueCaseMiddleware } from "./modules/dengue/dengue-case/dengue-case.middleware.js"
import { DengueCaseModule } from "./modules/dengue/dengue-case/dengue-case.module.js"
import { DengueCaseRepository } from "./modules/dengue/dengue-case/dengue-case.repository.js"
import { SentinelSurveillanceController } from "./modules/dengue/sentinel-surveillance/sentinel-surveillance.controller.js"
import { SentinelSurveillanceMiddleware } from "./modules/dengue/sentinel-surveillance/sentinel-surveillance.middleware.js"
import { SentinelSurveillanceModule } from "./modules/dengue/sentinel-surveillance/sentinel-surveillance.module.js"
import { SentinelSurveillanceRepository } from "./modules/dengue/sentinel-surveillance/sentinel-surveillance.repository.js"
import { DisposalInstructionModule } from "./modules/disposal/disposal-instruction/disposal-instruction.module.js"
import { DisposalMethodsController } from "./modules/disposal/methods/disposal-methods.controller.js"
import { DisposalMethodsModule } from "./modules/disposal/methods/disposal-methods.module.js"
import { DisposalMethodsRepository } from "./modules/disposal/methods/disposal-methods.repository.js"
import { SelfDisposalController } from "./modules/disposal/self-disposal/self-disposal.controller.js"
import { SelfDisposalMiddleware } from "./modules/disposal/self-disposal/self-disposal.middleware.js"
import { SelfDisposalModule } from "./modules/disposal/self-disposal/self-disposal.module.js"
import { SelfDisposalPublisher } from "./modules/disposal/self-disposal/self-disposal.publisher.js"
import { SelfDisposalRepository } from "./modules/disposal/self-disposal/self-disposal.repository.js"
import { DisposalShipmentController } from "./modules/disposal/shipment/shipment.controller.js"
import { DisposalShipmentMiddleware } from "./modules/disposal/shipment/shipment.middleware.js"
import { DisposalShipmentModule } from "./modules/disposal/shipment/shipment.module.js"
import { DisposalShipmentRepository } from "./modules/disposal/shipment/shipment.repository.js"
import { DisposalStockController } from "./modules/disposal/stocks/disposal-stock.controller.js"
import { DisposalStockMiddleware } from "./modules/disposal/stocks/disposal-stock.middleware.js"
import { DisposalStockModule } from "./modules/disposal/stocks/disposal-stock.module.js"
import { DisposalStockRepository } from "./modules/disposal/stocks/disposal-stock.repository.js"
import { EducationRepository } from "./modules/education/education.repository.js"
import { EmonevController } from "./modules/emonev/emonev.controller.js"
import { EmonevModule } from "./modules/emonev/emonev.module.js"
import { EmonevRepository } from "./modules/emonev/emonev.repository.js"
import { EntityActivityController } from "./modules/entity-activity/entity-activity.controller.js"
import { EntityActivityMiddleware } from "./modules/entity-activity/entity-activity.middleware.js"
import { EntityActivityModule } from "./modules/entity-activity/entity-activity.module.js"
import { EntityActivityPublisher } from "./modules/entity-activity/entity-activity.publisher.js"
import { EntityActivityRepository } from "./modules/entity-activity/entity-activity.repository.js"
import { EntityCustomerController } from "./modules/entity-customer/entity-customer.controller.js"
import { EntityCustomerMiddleware } from "./modules/entity-customer/entity-customer.middleware.js"
import { EntityCustomerModule } from "./modules/entity-customer/entity-customer.module.js"
import { EntityCustomerPublisher } from "./modules/entity-customer/entity-customer.publisher.js"
import { EntityCustomerRepository } from "./modules/entity-customer/entity-customer.repository.js"
import { EntityMaterialController } from "./modules/entity-material/entity-material.controller.js"
import { EntityMaterialExcelController } from "./modules/entity-material/entity-material.excel.controller.js"
import { EntityMaterialExcelMiddleware } from "./modules/entity-material/entity-material.excel.middleware.js"
import { EntityMaterialExcelModule } from "./modules/entity-material/entity-material.excel.module.js"
import { EntityMaterialMiddleware } from "./modules/entity-material/entity-material.middleware.js"
import { EntityMaterialModule } from "./modules/entity-material/entity-material.module.js"
import { EntityMaterialPublisher } from "./modules/entity-material/entity-material.publisher.js"
import { EntityMaterialRepository } from "./modules/entity-material/entity-material.repository.js"
import { EntitySchoolController } from "./modules/entity-school/entity-school.controller.js"
import { EntitySchoolModule } from "./modules/entity-school/entity-school.module.js"
import { EntitySchoolReposity } from "./modules/entity-school/entity-school.repository.js"
import { EntityTagController } from "./modules/entity-tag/entity-tag.controller.js"
import { EntityTagModule } from "./modules/entity-tag/entity-tag.module.js"
import { EntityTagRepository } from "./modules/entity-tag/entity-tag.repository.js"
import { EntityTypeController } from "./modules/entity-type/entity-type.controller.js"
import { EntityTypeModule } from "./modules/entity-type/entity-type.module.js"
import { EntityTypeRepository } from "./modules/entity-type/entity-type.repository.js"
import { EntityUserController } from "./modules/entity-user/entity-user.controller.js"
import { EntityUserModule } from "./modules/entity-user/entity-user.module.js"
import { EntityUserRepository } from "./modules/entity-user/entity-user.repository.js"
import { EntityVendorController } from "./modules/entity-vendor/entity-vendor.controller.js"
import { EntityVendorModule } from "./modules/entity-vendor/entity-vendor.module.js"
import { EntityVendorRepository } from "./modules/entity-vendor/entity-vendor.repository.js"
import { EntityController } from "./modules/entity/entity.controller.js"
import { EntityMiddleware } from "./modules/entity/entity.middleware.js"
import { EntityModule } from "./modules/entity/entity.module.js"
import { EntityPublisher } from "./modules/entity/entity.publisher.js"
import { EntityRepository } from "./modules/entity/entity.repository.js"
import { EntityWorker } from "./modules/entity/entity.worker.js"
import { EthnicRepository } from "./modules/ethnic/ethnic.repository.js"
import { EventReportCommentRepository } from "./modules/event-report-comment/event-report-comment.repository.js"
import { EventReportHistoryRepository } from "./modules/event-report-history/event-report-history.repository.js"
import { EventReportItemRepository } from "./modules/event-report-item/event-report-item.repository.js"
import { EventReportReasonController } from "./modules/event-report-reason/event-report-reason.controller.js"
import { EventReportReasonModule } from "./modules/event-report-reason/event-report-reason.module.js"
import { EventReportReasonRepository } from "./modules/event-report-reason/event-report-reason.repository.js"
import { EventReportStatusController } from "./modules/event-report-status/event-report-status.controller.js"
import { EventReportStatusModule } from "./modules/event-report-status/event-report-status.module.js"
import { EventReportStatusRepository } from "./modules/event-report-status/event-report-status.repository.js"
import { EventReportController } from "./modules/event-report/event-report.controller.js"
import { EventReportMiddleware } from "./modules/event-report/event-report.middleware.js"
import { EventReportModule } from "./modules/event-report/event-report.module.js"
import { EventReportRepository } from "./modules/event-report/event-report.repository.js"
import ExportHistoryRepository from "./modules/export-history/export-history.repository.js"
import { ImmunizationLogisticsController } from "./modules/immunization-logistics/immunization-logistics.controller.js"
import { ImmunizationLogisticsModule } from "./modules/immunization-logistics/immunization-logistics.module.js"
import { ImmunizationLogisticsRepository } from "./modules/immunization-logistics/immunization-logistics.repository.js"
import { ImmunizationController } from "./modules/immunization/immunization.controller.js"
import { ImmunizationMiddleware } from "./modules/immunization/immunization.middleware.js"
import { ImmunizationModule } from "./modules/immunization/immunization.module.js"
import { ImmunizationRepository } from "./modules/immunization/immunization.repository.js"
import { IntegrationController } from "./modules/integration/integration.controller.js"
import { IntegrationModule } from "./modules/integration/integration.module.js"
import { IntegrationRepository } from "./modules/integration/integration.repository.js"
import { LocationRepository } from "./modules/location/location.repository.js"
import { LoggerHistoryController } from "./modules/logger-history/logger-history.controller.js"
import { LoggerHistoryModule } from "./modules/logger-history/logger-history.module.js"
import { LoggerHistoryRepository } from "./modules/logger-history/logger-history.repository.js"
import { LoggerController } from "./modules/logger/logger.controller.js"
import { LoggerModule } from "./modules/logger/logger.module.js"
import { LoggerRepository } from "./modules/logger/logger.repository.js"
import { ManufactureController } from "./modules/manufacture/manufacture.controller.js"
import { ManufactureModule } from "./modules/manufacture/manufacture.module.js"
import { ManufacturePublisher } from "./modules/manufacture/manufacture.publisher.js"
import { ManufactureRepository } from "./modules/manufacture/manufacture.repository.js"
import { MaterialActivityRepository } from "./modules/material-activity/material-activity.repository.js"
import { MaterialLevelRepository } from "./modules/material-level/material-level.repository.js"
import { MaterialRatioController } from "./modules/material-ratio/material-ratio.controller.js"
import { MaterialRatioExcelController } from "./modules/material-ratio/material-ratio.excel.controller.js"
import { MaterialRatioExcelMiddleware } from "./modules/material-ratio/material-ratio.excel.middleware.js"
import { MaterialRatioExcelModule } from "./modules/material-ratio/material-ratio.excel.module.js"
import { MaterialRatioExcelRepository } from "./modules/material-ratio/material-ratio.excel.repository.js"
import { MaterialRatioMiddleware } from "./modules/material-ratio/material-ratio.middleware.js"
import { MaterialRatioModule } from "./modules/material-ratio/material-ratio.module.js"
import { MaterialRatioRepository } from "./modules/material-ratio/material-ratio.repository.js"
import { MaterialRatioValidator } from "./modules/material-ratio/material-ratio.validator.js"
import { MaterialSubtypeController } from "./modules/material-subtype/material-subtype.controller.js"
import { MaterialSubtypeModule } from "./modules/material-subtype/material-subtype.module.js"
import { MaterialSubtypeRepository } from "./modules/material-subtype/material-subtype.repository.js"
import { MaterialTargetsController } from "./modules/material-targets/material-targets.controller.js"
import { MaterialTargetsModule } from "./modules/material-targets/material-targets.module.js"
import { MaterialTargetsRepository } from "./modules/material-targets/material-targets.repository.js"
import { MaterialUnitRepository } from "./modules/material-unit/material-unit.repository.js"
import { MaterialController } from "./modules/material/material.controller.js"
import { MaterialMiddleware } from "./modules/material/material.middleware.js"
import { MaterialModule } from "./modules/material/material.module.js"
import { MaterialPublisher } from "./modules/material/material.publisher.js"
import { MaterialRepository } from "./modules/material/material.repository.js"
import { MicroplanningDashboardController } from "./modules/microplanning-dashboard/microplanning-dashboard.controller.js"
import { MicroplanningDashboardModule } from "./modules/microplanning-dashboard/microplanning-dashboard.module.js"
import { MicroplanningController } from "./modules/microplanning/microplanning.controller.js"
import { MicroplanningModule } from "./modules/microplanning/microplanning.module.js"
import { MicroplanningRepository } from "./modules/microplanning/microplanning.repository.js"
import { NonBiasImmunizationLogisticsController } from "./modules/non-bias-immunization-logistics/non-bias-immunization-logistics.controller.js"
import { NonBiasImmunizationLogisticsModule } from "./modules/non-bias-immunization-logistics/non-bias-immunization-logistics.module.js"
import { NonBiasImmunizationLogisticsRepository } from "./modules/non-bias-immunization-logistics/non-bias-immunization-logistics.repository.js"
import { NotificationController } from "./modules/notification/notification.controller.js"
import { NotificationModule } from "./modules/notification/notification.module.js"
import { NotificationPublisher } from "./modules/notification/notification.publisher.js"
import { NotificationRepository } from "./modules/notification/notification.repository.js"
import { OccupationRepository } from "./modules/occupation/occupation.repository.js"
import { OrderAllocationController } from "./modules/order-allocation/order-allocation.controller.js"
import { OrderAllocationMiddleware } from "./modules/order-allocation/order-allocation.middleware.js"
import { OrderAllocationModule } from "./modules/order-allocation/order-allocation.module.js"
import { OrderAllocationRepository } from "./modules/order-allocation/order-allocation.repository.js"
import { OrderAuditRepository } from "./modules/order-audit/order-audit.repository.js"
import { OrderCancelReasonController } from "./modules/order-cancel-reason/order-cancel-reason.controller.js"
import { OrderCancelReasonModule } from "./modules/order-cancel-reason/order-cancel-reason.module.js"
import { OrderCancelReasonRepository } from "./modules/order-cancel-reason/order-cancel-reason.repository.js"
import { OrderCentralDeliveryController } from "./modules/order-central-delivery/order-central-delivery.controller.js"
import { OrderCentralDeliveryMiddleware } from "./modules/order-central-delivery/order-central-delivery.middleware.js"
import { OrderCentralDeliveryModule } from "./modules/order-central-delivery/order-central-delivery.module.js"
import { OrderCommentController } from "./modules/order-comment/order-comment.controller.js"
import { OrderCommentMiddleware } from "./modules/order-comment/order-comment.middleware.js"
import { OrderCommentModule } from "./modules/order-comment/order-comment.module.js"
import { OrderCommentPublisher } from "./modules/order-comment/order-comment.publisher.js"
import { OrderCommentRepository } from "./modules/order-comment/order-comment.repository.js"
import { OrderHistoryRepository } from "./modules/order-history/order-history.repository.js"
import { OrderIntegrationRepository } from "./modules/order-integration/order-integration.repository.js"
import { OrderIntegrationWorker } from "./modules/order-integration/order-integration.worker.js"
import { OrderItemStockController } from "./modules/order-item-stock/order-item-stock.controller.js"
import { OrderItemStockMiddleware } from "./modules/order-item-stock/order-item-stock.middleware.js"
import { OrderItemStockModule } from "./modules/order-item-stock/order-item-stock.module.js"
import { OrderItemStockPublisher } from "./modules/order-item-stock/order-item-stock.publisher.js"
import { OrderItemStockRepository } from "./modules/order-item-stock/order-item-stock.repository.js"
import { OrderOtherReasonRepository } from "./modules/order-other-reason/order-other-reason.repository.js"
import { OrderReasonController } from "./modules/order-reason/order-reason.controller.js"
import { OrderReasonModule } from "./modules/order-reason/order-reason.module.js"
import { OrderReasonRepository } from "./modules/order-reason/order-reason.repository.js"
import { OrderRelocationController } from "./modules/order-relocation/order-relocation.controller.js"
import { OrderRelocationMiddleware } from "./modules/order-relocation/order-relocation.middleware.js"
import { OrderRelocationModule } from "./modules/order-relocation/order-relocation.module.js"
import { OrderRelocationRepository } from "./modules/order-relocation/order-relocation.repository.js"
import { OrderReturnController } from "./modules/order-return/order-return.controller.js"
import { OrderReturnMiddleware } from "./modules/order-return/order-return.middleware.js"
import { OrderReturnModule } from "./modules/order-return/order-return.module.js"
import { OrderReturnRepository } from "./modules/order-return/order-return.repository.js"
import { OrderStatusAllocateController } from "./modules/order-status/order-status-allocate/order-status-allocate.controller.js"
import { OrderStatusAllocateMiddleware } from "./modules/order-status/order-status-allocate/order-status-allocate.middleware.js"
import { OrderStatusAllocateModule } from "./modules/order-status/order-status-allocate/order-status-allocate.module.js"
import { OrderStatusAllocatePublisher } from "./modules/order-status/order-status-allocate/order-status-allocate.publisher.js"
import { OrderStatusAllocateRepository } from "./modules/order-status/order-status-allocate/order-status-allocate.repository.js"
import { OrderStatusCancelController } from "./modules/order-status/order-status-cancel/order-status-cancel.controller.js"
import { OrderStatusCancelMiddleware } from "./modules/order-status/order-status-cancel/order-status-cancel.middleware.js"
import { OrderStatusCancelModule } from "./modules/order-status/order-status-cancel/order-status-cancel.module.js"
import { OrderStatusCancelPublisher } from "./modules/order-status/order-status-cancel/order-status-cancel.publisher.js"
import { OrderStatusCancelRepository } from "./modules/order-status/order-status-cancel/order-status-cancel.repository.js"
import { OrderStatusConfirmController } from "./modules/order-status/order-status-confirm/order-status-confirm.controller.js"
import { OrderStatusConfirmMiddleware } from "./modules/order-status/order-status-confirm/order-status-confirm.middleware.js"
import { OrderStatusConfirmModule } from "./modules/order-status/order-status-confirm/order-status-confirm.module.js"
import { OrderStatusConfirmPublisher } from "./modules/order-status/order-status-confirm/order-status-confirm.publisher.js"
import { OrderStatusConfirmRepository } from "./modules/order-status/order-status-confirm/order-status-confirm.repository.js"
import { OrderStatusFulfilledController } from "./modules/order-status/order-status-fulfilled/order-status-fulfilled.controller.js"
import { OrderStatusFulfilledMiddleware } from "./modules/order-status/order-status-fulfilled/order-status-fulfilled.middleware.js"
import { OrderStatusFulfilledModule } from "./modules/order-status/order-status-fulfilled/order-status-fulfilled.module.js"
import { OrderStatusFulfilledPublisher } from "./modules/order-status/order-status-fulfilled/order-status-fulfilled.publisher.js"
import { OrderStatusFulfilledRepository } from "./modules/order-status/order-status-fulfilled/order-status-fulfilled.repository.js"
import { OrderStatusPendingController } from "./modules/order-status/order-status-pending/order-status-pending.controller.js"
import { OrderStatusPendingMiddleware } from "./modules/order-status/order-status-pending/order-status-pending.middleware.js"
import { OrderStatusPendingModule } from "./modules/order-status/order-status-pending/order-status-pending.module.js"
import { OrderStatusPendingRepository } from "./modules/order-status/order-status-pending/order-status-pending.repository.js"
import { OrderStatusShipController } from "./modules/order-status/order-status-ship/order-status-ship.controller.js"
import { OrderStatusShipMiddleware } from "./modules/order-status/order-status-ship/order-status-ship.middleware.js"
import { OrderStatusShipModule } from "./modules/order-status/order-status-ship/order-status-ship.module.js"
import { OrderStatusShippedPublisher } from "./modules/order-status/order-status-ship/order-status-ship.publisher.js"
import { OrderStatusShipRepository } from "./modules/order-status/order-status-ship/order-status-ship.repository.js"
import { OrderStatusValidateController } from "./modules/order-status/order-status-validate/order-status-validate.controller.js"
import { OrderStatusValidateMiddleware } from "./modules/order-status/order-status-validate/order-status-validate.middleware.js"
import { OrderStatusValidateModule } from "./modules/order-status/order-status-validate/order-status-validate.module.js"
import { OrderStatusValidateRepository } from "./modules/order-status/order-status-validate/order-status-validate.repository.js"
import { OrderStockStatusRepository } from "./modules/order-stock-status/order-stock-status.repository.js"
import { OrderTypeRepository } from "./modules/order-type/order-type.repository.js"
import { OrderController } from "./modules/order/order.controller.js"
import { OrderMiddleware } from "./modules/order/order.middleware.js"
import { OrderModule } from "./modules/order/order.module.js"
import { OrderPublisher } from "./modules/order/order.publisher.js"
import { OrderRepository } from "./modules/order/order.repository.js"
import { OrderWorker } from "./modules/order/order.worker.js"
import { PopulationController } from "./modules/population/population.controller.js"
import { PopulationModule } from "./modules/population/population.module.js"
import { PopulationRepository } from "./modules/population/population.repository.js"
import { ProtocolController } from "./modules/protocol/protocol.controller.js"
import { ProtocolModule } from "./modules/protocol/protocol.module.js"
import { ProtocolRepository } from "./modules/protocol/protocol.repository.js"
import { ProvinceController } from "./modules/province/province.controller.js"
import { ProvinceModule } from "./modules/province/province.module.js"
import { ProvinceRepository } from "./modules/province/province.repository.js"
import { ReconciliationAdditionalController } from "./modules/reconciliation-additional/reconciliation-additional.controller.js"
import { ReconciliationAdditionalModule } from "./modules/reconciliation-additional/reconciliation-additional.module.js"
import { ReconciliationAdditionalRepository } from "./modules/reconciliation-additional/reconciliation-additional.repository.js"
import { ReconciliationController } from "./modules/reconciliation/reconciliation.controller.js"
import { ReconciliationMiddleware } from "./modules/reconciliation/reconciliation.middleware.js"
import { ReconciliationModule } from "./modules/reconciliation/reconciliation.module.js"
import { ReconciliationRepository } from "./modules/reconciliation/reconciliation.repository.js"
import { ReconciliationWorker } from "./modules/reconciliation/reconciliation.worker.js"
import { RegencyController } from "./modules/regency/regency.controller.js"
import { RegencyModule } from "./modules/regency/regency.module.js"
import { RegencyRepository } from "./modules/regency/regency.repository.js"
import { ReligionRepository } from "./modules/religion/religion.repository.js"
import { RoleRepository } from "./modules/role/role.repository.js"
import {
  SismalController,
  SismalModule,
  SismalRepository,
} from "./modules/sismal/index.js"
import { StockConsumptionController } from "./modules/stock-consumption/stock-consumption.controller.js"
import { StockConsumptionModule } from "./modules/stock-consumption/stock-consumption.module.js"
import { StockConsumptionRepository } from "./modules/stock-consumption/stock-consumption.repository.js"
import { StockLoggingController } from "./modules/stock-logging/stock-logging.controller.js"
import { StockLoggingModule } from "./modules/stock-logging/stock-logging.module.js"
import { StockLoggingRepository } from "./modules/stock-logging/stock-logging.repository.js"
import {
  StockOpnamePeriodController,
  StockOpnamePeriodModule,
  StockOpnamePeriodRepository,
} from "./modules/stock-opname-period/index.js"
import {
  StockOpnameController,
  StockOpnameModule,
  StockOpnameRepository,
} from "./modules/stock-opname/index.js"
import { StockOpnameMiddleware } from "./modules/stock-opname/stock-opname.middleware.js"
import { StockOpnameWorker } from "./modules/stock-opname/stock-opname.worker.js"
import { StockQualityController } from "./modules/stock-quality/stock-quality.controller.js"
import { StockQualityModule } from "./modules/stock-quality/stock-quality.module.js"
import { StockQualityRepository } from "./modules/stock-quality/stock-quality.repository.js"
import { StockController } from "./modules/stock/stock.controller.js"
import { StockMiddleware } from "./modules/stock/stock.middleware.js"
import { StockModule } from "./modules/stock/stock.module.js"
import { StockNonHierarchyRepository } from "./modules/stock/stock.non-hierarchy.repository.js"
import { StockPublisher } from "./modules/stock/stock.publisher.js"
import { StockRepository } from "./modules/stock/stock.repository.js"
import { StockWorker } from "./modules/stock/stock.worker.js"
import { SubDistrictController } from "./modules/sub-district/sub-district.controller.js"
import { SubDistrictModule } from "./modules/sub-district/sub-district.module.js"
import { SubDistrictRepository } from "./modules/sub-district/sub-district.repository.js"
import { SyncExampleController } from "./modules/sync-example/sync-example.controller.js"
import { SyncExampleModule } from "./modules/sync-example/sync-example.module.js"
import { TargetEstimationBiasRepository } from "./modules/target-estimation-bias/target-estimation-bias.repository.js"
import { TargetEstimationNonBiasRepository } from "./modules/target-estimation-non-bias/target-estimation-non-bias.repository.js"
import { TargetEstimationController } from "./modules/target-estimation/target-estimation.controller.js"
import { TargetEstimationMiddleware } from "./modules/target-estimation/target-estimation.middleware.js"
import { TargetEstimationModule } from "./modules/target-estimation/target-estimation.module.js"
import { TargetGroupRepository } from "./modules/target-group/target-group.repository.js"
import { TargetsController } from "./modules/targets/targets.controller.js"
import { TargetsMiddleware } from "./modules/targets/targets.middleware.js"
import { TargetsModule } from "./modules/targets/targets.module.js"
import { TargetsRepository } from "./modules/targets/targets.repository.js"
import { TaskController } from "./modules/task/task.controller.js"
import { TaskExcelController } from "./modules/task/task.excel.controller.js"
import { TaskExcelMiddleware } from "./modules/task/task.excel.middleware.js"
import { TaskExcelModule } from "./modules/task/task.excel.module.js"
import { TaskExcelRepository } from "./modules/task/task.excel.repository.js"
import { TaskMiddleware } from "./modules/task/task.middleware.js"
import { TaskModule } from "./modules/task/task.module.js"
import { TaskRepository } from "./modules/task/task.repository.js"
import { TransactionTransferStockController } from "./modules/transaction-transfer-stock/transaction-transfer-stock.controller.js"
import { TransactionTransferStockMiddleware } from "./modules/transaction-transfer-stock/transaction-transfer-stock.middleware.js"
import { TransactionTransferStockModule } from "./modules/transaction-transfer-stock/transaction-transfer-stock.module.js"
import { TransactionTransferStockPublisher } from "./modules/transaction-transfer-stock/transaction-transfer-stock.publisher.js"
import { TransactionTransferStockRepository } from "./modules/transaction-transfer-stock/transaction-transfer-stock.repository.js"
import { TransactionTypeRepository } from "./modules/transaction-type/transaction-type.repository.js"
import { ConsumptionRabiesController } from "./modules/transaction/consumption-rabies/consumption-rabies.controller.js"
import { ConsumptionRabiesMiddleware } from "./modules/transaction/consumption-rabies/consumption-rabies.middleware.js"
import { ConsumptionRabiesModule } from "./modules/transaction/consumption-rabies/consumption-rabies.module.js"
import { ConsumptionRabiesRepository } from "./modules/transaction/consumption-rabies/consumption-rabies.repository.js"
import { ConsumptionReactionController } from "./modules/transaction/consumption-reaction/consumption-reaction.controller.js"
import { ConsumptionReactionMiddleware } from "./modules/transaction/consumption-reaction/consumption-reaction.middleware.js"
import { ConsumptionReactionModule } from "./modules/transaction/consumption-reaction/consumption-reaction.module.js"
import { ConsumptionReactionRepository } from "./modules/transaction/consumption-reaction/consumption-reaction.repository.js"
import { ConsumptionController } from "./modules/transaction/consumption/consumption.controller.js"
import { ConsumptionMiddleware } from "./modules/transaction/consumption/consumption.middleware.js"
import { ConsumptionModule } from "./modules/transaction/consumption/consumption.module.js"
import { ConsumptionRepository } from "./modules/transaction/consumption/consumption.repository.js"
import { TransactionDetailController } from "./modules/transaction/detail/detail.controller.js"
import { TransactionDetailModule } from "./modules/transaction/detail/detail.module.js"
import { TransactionDetailRepository } from "./modules/transaction/detail/detail.repository.js"
import { PatientController } from "./modules/transaction/patient/patient.controller.js"
import { PatientModule } from "./modules/transaction/patient/patient.module.js"
import { PatientRepository } from "./modules/transaction/patient/patient.repository.js"
import { DisposalService } from "./modules/transaction/services/disposal.service.js"
import { TransactionController } from "./modules/transaction/transaction.controller.js"
import { TransactionsMiddleware } from "./modules/transaction/transaction.middleware.js"
import { TransactionModule } from "./modules/transaction/transaction.module.js"
import { TransactionPublisher } from "./modules/transaction/transaction.publisher.js"
import { TransactionRepository } from "./modules/transaction/transaction.repository.js"
import { TransactionWorker } from "./modules/transaction/transaction.worker.js"
import { TransferStockController } from "./modules/transfer-stock/transfer-stock.controller.js"
import { TransferStockModule } from "./modules/transfer-stock/transfer-stock.module.js"
import { TransferStockRepository } from "./modules/transfer-stock/transfer-stock.repository.js"
import { UserPublisher } from "./modules/user/user.publisher.js"
import { VillageController } from "./modules/village/village.controller.js"
import { VillageModule } from "./modules/village/village.module.js"
import { VillageRepository } from "./modules/village/village.repository.js"
import { ColdstoragePublisher } from "./modules/coldstorage/coldstorage.publisher.js"

// inject dependencies
const mq = getConnection
const trxManager = new TransactionManager(db)
const publisher = new Publisher(mq)

const userRepo = new UserRepository()
const materialUnitRepo = new MaterialUnitRepository()
const materialRepo = new MaterialRepository()
const activityRepo = new ActivityRepository()
const manufactureRepo = new ManufactureRepository()
const entityMaterialRepo = new EntityMaterialRepository()
const entityRepo = new EntityRepository()
const entityTagRepo = new EntityTagRepository()
const provinceRepo = new ProvinceRepository()
const regencyRepo = new RegencyRepository()
const subDistrictRepo = new SubDistrictRepository()
const villageRepo = new VillageRepository()
const entityCustomerRepository = new EntityCustomerRepository()
const entityVendorRepository = new EntityVendorRepository()
const budgetSourceRepo = new BudgetSourceRepository()
const entityUserRepository = new EntityUserRepository()
const entityActivityRepository = new EntityActivityRepository()
const roleRepo = new RoleRepository()
const materialActivityRepo = new MaterialActivityRepository()
const orderAuditRepo = new OrderAuditRepository()
const orderCommentRepo = new OrderCommentRepository()
const orderHistoryRepo = new OrderHistoryRepository()
const orderItemStockRepo = new OrderItemStockRepository()
const orderOtherReasonRepo = new OrderOtherReasonRepository()
const orderReasonRepo = new OrderReasonRepository()
const orderRepo = new OrderRepository()
const orderStockStatusRepo = new OrderStockStatusRepository()
const orderTypeRepo = new OrderTypeRepository()
const stockRepo = new StockRepository()
const sismalRepo = new SismalRepository()
const stockOpnameRepo = new StockOpnameRepository()
const stockOpnamePeriodRepo = new StockOpnamePeriodRepository()
const transactionRepo = new TransactionRepository()
const consumptionRabiesRepo = new ConsumptionRabiesRepository()
const batchRepo = new BatchRepository()
const stockQualityRepo = new StockQualityRepository()
const stockConsumptionRepo = new StockConsumptionRepository()
const transactionTypeRepo = new TransactionTypeRepository()
const orderStatusConfirmRepo = new OrderStatusConfirmRepository()
const orderStatusValidateRepo = new OrderStatusValidateRepository()
const orderStatusPendingRepo = new OrderStatusPendingRepository()
const orderStatusAllocateRepo = new OrderStatusAllocateRepository()
const orderStatusShipRepo = new OrderStatusShipRepository()
const orderStatusFulfilledRepo = new OrderStatusFulfilledRepository()
const orderStatusCancelRepo = new OrderStatusCancelRepository()
const orderReturnRepo = new OrderReturnRepository()
const orderAllocationRepo = new OrderAllocationRepository()
const rolesToResourceMappingRepo = new RolesToResourceMappingRepository()
const contractRepo = new ContractRepository()
const disposalMethodsRepo = new DisposalMethodsRepository()
const selfDisposalRepo = new SelfDisposalRepository()
const targetGroupsRepo = new TargetGroupRepository()
const targetEstimationNonBiasRepo = new TargetEstimationNonBiasRepository()
const targetEstimationBiasRepo = new TargetEstimationBiasRepository()

// Disposal Instruction
const disposalInstructionModule = new DisposalInstructionModule()
const disposalInstructionController = disposalInstructionModule.getController()
const entityTypeRepo = new EntityTypeRepository()
const orderCancelReasonRepo = new OrderCancelReasonRepository()
const eventReportRepo = new EventReportRepository()
const eventReportHistoryRepo = new EventReportHistoryRepository()
const eventReportCommentRepo = new EventReportCommentRepository()
const eventReportItemRepo = new EventReportItemRepository()
const eventReportStatusRepo = new EventReportStatusRepository()
const reconciliationAdditionalRepo = new ReconciliationAdditionalRepository()
const eventReportReasonRepo = new EventReportReasonRepository()
const assetVendorRepo = new AssetVendorRepository()
const assetTypeRepo = new AssetTypeRepository()
const assetModelRepo = new AssetModelRepository()
const assetWorkingStatusRepo = new AssetWorkingStatusRepository()
const assetElectricityRepo = new AssetElectricityRepository()
const assetCalibrationScheduleRepo = new AssetCalibrationScheduleRepository()
const assetMaintenanceScheduleRepo = new AssetMaintenanceScheduleRepository()
const exportHistoryRepo = new ExportHistoryRepository()
const assetInventoryRepo = new AssetInventoryRepository()
const loggerRepo = new LoggerRepository()
const orderRelocationRepo = new OrderRelocationRepository()
const integrationRepo = new OrderIntegrationRepository()
const emonevRepo = new EmonevRepository()
const notificationRepo = new NotificationRepository()
const patientRepo = new PatientRepository()
const targetsRepo = new TargetsRepository()
const transactionDetailRepo = new TransactionDetailRepository()
const consumptionReactionRepo = new ConsumptionReactionRepository()
const notificationTypeRepo = new NotificationTypeRepository()
const educationRepo = new EducationRepository()
const ethnicRepo = new EthnicRepository()
const locationRepo = new LocationRepository()
const occupationRepo = new OccupationRepository()
const religionRepo = new ReligionRepository()
const annualCommitmentRepo = new AnnualCommitmentRepository()

const commonMiddleware = new CommonMiddleware()
const trxMiddleware = new TransactionMiddleware(trxManager)
const evtMiddleware = new EventMiddleware(publisher)
const authMiddleware = new AuthMiddleware(userRepo, entityRepo, activityRepo)
const authKeycloakMiddleware = new AuthKeycloakMiddleware(
  userRepo,
  activityRepo,
  entityRepo,
  integrationRepo,
  new AuthKeycloakService(
    env.AUTH_URL ?? "http://localhost:5001",
    env.USE_LOCAL_JWT_VALIDATION === "true"
  )
)
const requestMiddleware = new RequestMiddleware()
const excelMiddleware = new ExcelMiddleware()
const roleMiddleware = new RoleMiddleware()
const entityMiddleware = new EntityMiddleware(entityRepo)
const deduplicationMiddleware = new DeduplicationMiddleware()

const userModule = new UserModule(
  userRepo,
  entityRepo,
  roleRepo,
  new UserPublisher(publisher)
)
const userController = new UserController(userModule, excelMiddleware)

const materialPublisher = new MaterialPublisher(publisher, materialRepo)
const materialModule = new MaterialModule(
  materialRepo,
  new MaterialLevelRepository(),
  activityRepo,
  materialUnitRepo,
  manufactureRepo,
  userRepo,
  entityTypeRepo,
  materialPublisher
)
const materialController = new MaterialController(
  materialModule,
  new MaterialMiddleware(materialRepo, manufactureRepo, activityRepo),
  roleMiddleware,
  excelMiddleware
)

// Entity Material
const entityMaterialModule = new EntityMaterialModule(
  entityMaterialRepo,
  activityRepo,
  userRepo,
  materialRepo,
  stockRepo,
  new EntityMaterialPublisher(publisher)
)
const entityMaterialExcelModule = new EntityMaterialExcelModule(
  entityMaterialRepo,
  materialActivityRepo,
  userRepo
)
const entityMaterialMiddleware = new EntityMaterialMiddleware(
  entityMaterialRepo,
  activityRepo
)
const entityMaterialExceclMiddleware = new EntityMaterialExcelMiddleware(
  entityMaterialRepo,
  activityRepo,
  entityTagRepo,
  provinceRepo,
  regencyRepo,
  subDistrictRepo,
  villageRepo,
  materialRepo,
  entityRepo,
  materialActivityRepo
)
const entityMaterialController = new EntityMaterialController(
  entityMaterialModule,
  entityMaterialMiddleware,
  roleMiddleware
)
const entityMaterialExcelController = new EntityMaterialExcelController(
  entityMaterialExcelModule,
  entityMaterialExceclMiddleware,
  roleMiddleware,
  excelMiddleware
)

// Entity
const entityConsumer = new Consumer(mq, trxManager)
const entityWorker = new EntityWorker(entityRepo, exportHistoryRepo)
entityWorker.registerWorkers(entityConsumer)
const entityModule = new EntityModule(
  entityRepo,
  exportHistoryRepo,
  new EntityPublisher(publisher, entityRepo),
  userRepo,
  publisher,
  notificationTypeRepo
)
const entityController = new EntityController(
  entityModule,
  excelMiddleware,
  roleMiddleware,
  entityMiddleware
)

// Entity Customer
const entityCustomerModule = new EntityCustomerModule(
  entityCustomerRepository,
  new EntityCustomerPublisher(publisher, entityCustomerRepository)
)
const entityCustomerMiddleware = new EntityCustomerMiddleware(
  entityCustomerRepository
)
const entityCustomerController = new EntityCustomerController(
  entityCustomerModule,
  entityCustomerMiddleware,
  excelMiddleware,
  roleMiddleware
)

// Entity Vendor
const entityVendorModule = new EntityVendorModule(entityVendorRepository)
const entityVendorController = new EntityVendorController(
  entityVendorModule,
  roleMiddleware
)

// Entity User
const entityUserModule = new EntityUserModule(entityUserRepository)
const entityUserController = new EntityUserController(entityUserModule)

// Entity School
const entitySchoolRepositoty = new EntitySchoolReposity()
const entitySchoolModule = new EntitySchoolModule(entitySchoolRepositoty)
const entitySchoolController = new EntitySchoolController(entitySchoolModule)

// Material Targets
const materialTargetsRepository = new MaterialTargetsRepository()
const materialTargetsModule = new MaterialTargetsModule(
  materialTargetsRepository
)
const materialTargetsController = new MaterialTargetsController(
  materialTargetsModule
)

// Entity Activity
const entityActivityPublisher = new EntityActivityPublisher(
  publisher,
  entityRepo
)
const entityActivityModule = new EntityActivityModule(
  entityActivityRepository,
  entityActivityPublisher
)
const entityActivityMiddleware = new EntityActivityMiddleware(
  entityActivityRepository
)
const entityActivityController = new EntityActivityController(
  entityActivityModule,
  entityActivityMiddleware,
  roleMiddleware
)

// Entity Tag
const entityTagModule = new EntityTagModule(entityTagRepo)
const entityTagController = new EntityTagController(entityTagModule)

// Entity Type
const entityTypeModule = new EntityTypeModule(entityTypeRepo)
const entityTypeController = new EntityTypeController(entityTypeModule)

// Province
const provinceModule = new ProvinceModule(provinceRepo)
const provinceController = new ProvinceController(provinceModule)

// Regency
const regencyModule = new RegencyModule(regencyRepo)
const regencyController = new RegencyController(regencyModule)

// Sub District
const subDistrictModule = new SubDistrictModule(subDistrictRepo)
const subDistrictController = new SubDistrictController(subDistrictModule)

// Village
const villageModule = new VillageModule(villageRepo)
const villageController = new VillageController(villageModule)

// Activity
const activityPublisher = new ActivityPublisher(publisher)
const activityModule = new ActivityModule(
  activityRepo,
  userRepo,
  activityPublisher
)
const activityMiddleware = new ActivityMiddleware(
  activityRepo,
  transactionRepo,
  orderRepo
)
const activityController = new ActivityController(
  activityModule,
  activityMiddleware,
  excelMiddleware
)

// Budget-source
const budgetSourceMiddleware = new BudgetSourceMiddleware()
const budgetSourceModule = new BudgetSourceModule(budgetSourceRepo, userRepo)
const budgetSourceController = new BudgetSourceController(
  budgetSourceModule,
  excelMiddleware,
  budgetSourceMiddleware
)

// Manufacture
const manufactureModule = new ManufactureModule(
  manufactureRepo,
  userRepo,
  new ManufacturePublisher(publisher)
)
const manufactureController = new ManufactureController(manufactureModule)

// Order
const orderPublisher = new OrderPublisher(
  publisher,
  orderRepo,
  orderItemStockRepo,
  orderCommentRepo
)
const orderModule = new OrderModule(
  orderRepo,
  orderCommentRepo,
  orderItemStockRepo,
  orderOtherReasonRepo,
  orderAuditRepo,
  orderHistoryRepo,
  stockRepo,
  entityRepo,
  orderPublisher,
  exportHistoryRepo
)
const orderMiddleware = new OrderMiddleware(
  orderRepo,
  entityRepo,
  activityRepo,
  orderTypeRepo,
  materialRepo,
  orderReasonRepo,
  orderStockStatusRepo,
  entityVendorRepository,
  entityMaterialRepo
)
const orderControler = new OrderController(
  orderModule,
  orderMiddleware,
  roleMiddleware,
  excelMiddleware
)
const orderWorker = new OrderWorker(orderRepo, exportHistoryRepo)
const orderConsumer = new Consumer(mq, trxManager)
orderWorker.registerWorkers(orderConsumer)

// Order Dropping Publisher
const orderDroppingPublisher = new OrderDroppingPublisher(
  publisher,
  orderRepo,
  orderItemStockRepo,
  entityRepo,
  stockRepo,
  materialRepo,
  orderCommentRepo
)

// Order Allocation
const orderAllocationMiddleware = new OrderAllocationMiddleware(
  entityRepo,
  entityVendorRepository,
  materialRepo,
  orderAllocationRepo,
  activityRepo
)

const orderAllocationModule = new OrderAllocationModule(
  orderRepo,
  orderCommentRepo,
  orderItemStockRepo,
  orderAuditRepo,
  orderHistoryRepo,
  orderAllocationRepo,
  orderDroppingPublisher
)
const orderAllocationController = new OrderAllocationController(
  orderAllocationModule,
  orderAllocationMiddleware,
  roleMiddleware
)

// Order Return
const orderReturnMiddleware = new OrderReturnMiddleware(orderReturnRepo)
const orderReturnModule = new OrderReturnModule(
  orderReturnRepo,
  orderDroppingPublisher
)
const orderReturnController = new OrderReturnController(
  orderReturnMiddleware,
  orderReturnModule,
  roleMiddleware
)

// Centra Delivery / Distribution
const orderCentralDeliveryMiddleware = new OrderCentralDeliveryMiddleware(
  activityRepo,
  budgetSourceRepo,
  entityRepo,
  entityVendorRepository,
  manufactureRepo,
  materialRepo,
  entityActivityRepository,
  materialActivityRepo,
  entityMaterialRepo,
  batchRepo
)
const orderCentralDeliveryModule = new OrderCentralDeliveryModule(
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
  orderDroppingPublisher,
  new TransactionPublisher(publisher, transactionRepo)
)
const orderCentralDeliveryController = new OrderCentralDeliveryController(
  orderCentralDeliveryModule,
  orderCentralDeliveryMiddleware,
  roleMiddleware
)

// Order Relocation
const orderRelocationMiddleware = new OrderRelocationMiddleware(
  orderRelocationRepo,
  entityRepo,
  materialRepo,
  activityRepo,
  orderReasonRepo
)

const orderRelocationModule = new OrderRelocationModule(
  orderRelocationRepo,
  orderCommentRepo,
  orderItemStockRepo,
  orderAuditRepo,
  orderHistoryRepo,
  orderPublisher,
  notificationTypeRepo
)

const orderRelocationController = new OrderRelocationController(
  roleMiddleware,
  orderRelocationMiddleware,
  orderRelocationModule
)

// Order Item Stock
const orderItemStockMiddleware = new OrderItemStockMiddleware(
  orderItemStockRepo
)
const orderItemStockModule = new OrderItemStockModule(
  orderItemStockRepo,
  new OrderItemStockPublisher(publisher, orderItemStockRepo)
)
const orderItemStockController = new OrderItemStockController(
  orderItemStockMiddleware,
  orderItemStockModule,
  roleMiddleware
)

// Order Status Pending
const orderStatusPendingMiddleware = new OrderStatusPendingMiddleware(
  orderStatusPendingRepo
)
const orderStatusPendingModule = new OrderStatusPendingModule(
  orderStatusPendingRepo
)
const orderStatusPendingController = new OrderStatusPendingController(
  orderStatusPendingMiddleware,
  orderStatusPendingModule,
  roleMiddleware
)

// Order Status Confirm
const orderStatusConfirmMiddleware = new OrderStatusConfirmMiddleware(
  orderStatusConfirmRepo
)
const orderStatusConfirmModule = new OrderStatusConfirmModule(
  orderStatusConfirmRepo,
  new OrderStatusConfirmPublisher(publisher, orderStatusConfirmRepo)
)
const orderStatusConfirmController = new OrderStatusConfirmController(
  orderStatusConfirmMiddleware,
  orderStatusConfirmModule,
  roleMiddleware
)

// Order Status Validate
const orderIntegrationWorker = new OrderIntegrationWorker(integrationRepo)
const orderStatusValidateMiddleware = new OrderStatusValidateMiddleware(
  orderStatusValidateRepo
)
const orderStatusValidateModule = new OrderStatusValidateModule(
  orderStatusValidateRepo,
  orderIntegrationWorker,
  publisher
)
const orderStatusValidateController = new OrderStatusValidateController(
  orderStatusValidateMiddleware,
  orderStatusValidateModule,
  roleMiddleware
)

// Order Status Allocate
const orderStatusAllocateMiddleware = new OrderStatusAllocateMiddleware(
  orderStatusAllocateRepo,
  activityRepo
)
const orderStatusAllocateModule = new OrderStatusAllocateModule(
  orderStatusAllocateRepo,
  new OrderStatusAllocatePublisher(publisher, orderStatusAllocateRepo)
)
const orderStatusAllocateController = new OrderStatusAllocateController(
  orderStatusAllocateMiddleware,
  orderStatusAllocateModule,
  roleMiddleware
)

// Order Status Ship
const orderStatusShipMiddleware = new OrderStatusShipMiddleware(
  orderStatusShipRepo
)
const orderStatusShipModule = new OrderStatusShipModule(
  orderStatusShipRepo,
  new OrderStatusShippedPublisher(publisher, orderStatusShipRepo),
  new TransactionPublisher(publisher, transactionRepo),
  notificationTypeRepo,
  new ColdstoragePublisher(publisher, materialRepo, userRepo, entityRepo)
)
const orderStatusShipController = new OrderStatusShipController(
  orderStatusShipMiddleware,
  orderStatusShipModule,
  roleMiddleware
)

// Order Status Fulfilled
const orderStatusFulfilledMiddleware = new OrderStatusFulfilledMiddleware(
  orderStatusFulfilledRepo
)
const orderStatusFulfilledModule = new OrderStatusFulfilledModule(
  orderStatusFulfilledRepo,
  new OrderStatusFulfilledPublisher(publisher),
  new TransactionPublisher(publisher, transactionRepo),
  new NotificationPublisher(publisher),
  notificationRepo,
  new ColdstoragePublisher(publisher, materialRepo, userRepo, entityRepo)
)

const orderStatusFulfilledController = new OrderStatusFulfilledController(
  orderStatusFulfilledMiddleware,
  orderStatusFulfilledModule,
  roleMiddleware
)

// Order Status Cancel
const orderStatusCancelMiddleware = new OrderStatusCancelMiddleware(
  orderStatusCancelRepo
)
const orderStatusCancelModule = new OrderStatusCancelModule(
  orderStatusCancelRepo,
  new ColdstoragePublisher(publisher, materialRepo, userRepo, entityRepo),
  new OrderStatusCancelPublisher(publisher),
  new TransactionPublisher(publisher, transactionRepo)
)
const orderStatusCancelController = new OrderStatusCancelController(
  orderStatusCancelMiddleware,
  orderStatusCancelModule,
  roleMiddleware
)

// Order Reason
const orderReasonModule = new OrderReasonModule(orderReasonRepo)
const orderReasonControler = new OrderReasonController(orderReasonModule)

// Order Comment
const orderCommentMiddleware = new OrderCommentMiddleware(orderCommentRepo)
const orderCommentModule = new OrderCommentModule(
  orderCommentRepo,
  new OrderCommentPublisher(publisher)
)
const orderCommentController = new OrderCommentController(
  orderCommentMiddleware,
  orderCommentModule,
  roleMiddleware
)

// Stock
const stockModule = new StockModule(
  stockRepo,
  new StockNonHierarchyRepository(),
  entityRepo,
  materialRepo,
  activityRepo,
  stockOpnameRepo,
  exportHistoryRepo,
  new StockPublisher(publisher),
  userRepo,
  entityCustomerRepository,
  publisher,
  notificationTypeRepo
)
const stockController = new StockController(stockModule, new StockMiddleware())
const stockConsumer = new Consumer(mq, trxManager)
const stockWorker = new StockWorker(
  stockRepo,
  entityMaterialRepo,
  exportHistoryRepo
)
stockWorker.registerWorkers(stockConsumer)

const stockQualityModule = new StockQualityModule(stockQualityRepo)
const stockQualityController = new StockQualityController(stockQualityModule)

const stockConsumptionModule = new StockConsumptionModule(stockConsumptionRepo)
const stockConsumptionController = new StockConsumptionController(
  stockConsumptionModule
)

// Stock Opname
const stockOpnamePeriodModule = new StockOpnamePeriodModule(
  stockOpnamePeriodRepo,
  userRepo
)
const stockOpnamePeriodController = new StockOpnamePeriodController(
  stockOpnamePeriodModule,
  stockOpnamePeriodRepo,
  excelMiddleware
)
const stockOpnameModule = new StockOpnameModule(
  stockOpnameRepo,
  entityRepo,
  userRepo,
  activityRepo,
  materialRepo,
  stockOpnamePeriodRepo,
  exportHistoryRepo,
  publisher
)
const stockOpnameConsumer = new Consumer(mq, trxManager)
const stockOpnameWorker = new StockOpnameWorker(
  stockOpnameRepo,
  exportHistoryRepo
)
stockOpnameWorker.registerWorkers(stockOpnameConsumer)

const stockOpnameMiddleware = new StockOpnameMiddleware(
  stockOpnameRepo,
  stockOpnamePeriodRepo
)
const stockOpnameController = new StockOpnameController(
  stockOpnameModule,
  stockOpnameRepo,
  stockOpnameMiddleware,
  excelMiddleware
)

// Notification
const notificationPublisher = new NotificationPublisher(publisher)
const notificationModule = new NotificationModule(
  notificationRepo,
  userRepo,
  patientRepo,
  publisher,
  notificationTypeRepo
)
const notificationController = new NotificationController(notificationModule)

// Transaction Detail
const transactionDetailModule = new TransactionDetailModule(
  transactionDetailRepo
)
const transactionDetailController = new TransactionDetailController(
  transactionDetailModule
)

// Transaction
const disposalService = new DisposalService(transactionRepo)
const transactionModule = new TransactionModule(
  transactionRepo,
  stockRepo,
  batchRepo,
  manufactureRepo,
  stockQualityRepo,
  new TransactionPublisher(publisher, transactionRepo),
  disposalService,
  exportHistoryRepo,
  notificationRepo,
  notificationPublisher,
  new ColdstoragePublisher(publisher, materialRepo, userRepo, entityRepo)
)
const transactionConsumer = new Consumer(mq, trxManager)
const transactionWorker = new TransactionWorker(
  transactionRepo,
  exportHistoryRepo
)
transactionWorker.registerWorkers(transactionConsumer)

const transactionsMiddleware = new TransactionsMiddleware(
  transactionRepo,
  activityRepo,
  stockQualityRepo,
  materialRepo,
  stockRepo,
  entityActivityRepository,
  batchRepo,
  entityRepo
)
const transactionController = new TransactionController(
  transactionModule,
  transactionsMiddleware,
  roleMiddleware,
  deduplicationMiddleware
)

// Sismal
const sismalModule = new SismalModule(sismalRepo)
const sismalController = new SismalController(sismalModule)

// Transaction - Rabies
const consumptionRabiesModule = new ConsumptionRabiesModule(
  consumptionRabiesRepo,
  stockRepo,
  batchRepo,
  new TransactionPublisher(publisher, transactionRepo)
)
const consumptionRabiesMiddleware = new ConsumptionRabiesMiddleware(
  consumptionRabiesRepo,
  transactionRepo,
  activityRepo,
  entityActivityRepository
)
const consumptionRabiesController = new ConsumptionRabiesController(
  consumptionRabiesModule,
  consumptionRabiesMiddleware
)

// Transaction - Consumption Reaction (KIPI)
const consumptionReactionModule = new ConsumptionReactionModule(
  consumptionReactionRepo
)
const consumptionReactionMiddleware = new ConsumptionReactionMiddleware(
  consumptionReactionRepo
)
const consumptionReactionController = new ConsumptionReactionController(
  consumptionReactionModule,
  consumptionReactionMiddleware
)

// Patient
const patientModule = new PatientModule(
  patientRepo,
  educationRepo,
  occupationRepo,
  religionRepo,
  ethnicRepo,
  locationRepo,
  userRepo
)
const patientController = new PatientController(patientModule)

// Microplanning
const targetsModule = new TargetsModule(
  targetsRepo,
  locationRepo,
  targetGroupsRepo,
  entityRepo
)
const targetsMiddleware = new TargetsMiddleware(targetsRepo, locationRepo)
const targetsController = new TargetsController(
  targetsModule,
  targetsMiddleware
)

// Target Estimation
const targetEstimationMiddleware = new TargetEstimationMiddleware(
  targetEstimationNonBiasRepo
)
const targetEstimationModule = new TargetEstimationModule(
  targetEstimationNonBiasRepo,
  targetEstimationBiasRepo,
  locationRepo,
  entitySchoolRepositoty,
  targetsRepo
)
const targetEstimationController = new TargetEstimationController(
  targetEstimationMiddleware,
  targetEstimationModule
)

// Microplanning Dashboard
const microplanningDashboardModule = new MicroplanningDashboardModule(
  locationRepo,
  targetsRepo
)
const microplanningDashboardController = new MicroplanningDashboardController(
  microplanningDashboardModule,
  excelMiddleware
)

const microplanningRepo = new MicroplanningRepository()
const microplanningModule = new MicroplanningModule(microplanningRepo)
const microplanningController = new MicroplanningController(microplanningModule)

// Batch
const batchModule = new BatchModule(batchRepo)
const batchController = new BatchController(batchModule)

const syncExampleModule = new SyncExampleModule(publisher)
const syncExampleController = new SyncExampleController(syncExampleModule)

// App mobile data
const appMobileDataModule = new AppMobileDataModule(
  transactionTypeRepo,
  entityCustomerRepository,
  entityVendorRepository,
  activityRepo,
  entityActivityRepository,
  entityMaterialRepo,
  manufactureRepo,
  materialRepo,
  stockRepo,
  batchRepo,
  budgetSourceRepo,
  orderRepo
)
const appMobileDataController = new AppMobileDataController(
  appMobileDataModule,
  roleMiddleware
)

// App mobile notif
const appMobileNotifRepo = new AppMobileNotifRepository()
const appMobileNotifModule = new AppMobileNotifModule(appMobileNotifRepo)
const appMobileNotifController = new AppMobileNotifController(
  appMobileNotifModule,
  roleMiddleware
)

// contract
const contractModule = new ContractModule(contractRepo)
const contractController = new ContractController(contractModule)

// Disposal Methods
const disposalMethodsModule = new DisposalMethodsModule(disposalMethodsRepo)
const disposalMethodsController = new DisposalMethodsController(
  disposalMethodsModule
)

// Self Disposal
const selfDisposalPublisher = new SelfDisposalPublisher(
  publisher,
  selfDisposalRepo
)
const selfDisposalModule = new SelfDisposalModule(
  selfDisposalRepo,
  selfDisposalPublisher,
  entityRepo,
  materialRepo,
  userRepo,
  activityRepo
)
const selfDisposalMiddleware = new SelfDisposalMiddleware(selfDisposalRepo)
const selfDisposalController = new SelfDisposalController(
  selfDisposalModule,
  selfDisposalMiddleware,
  roleMiddleware,
  excelMiddleware
)

// event Report
const eventReportModule = new EventReportModule(
  eventReportRepo,
  eventReportHistoryRepo,
  eventReportCommentRepo,
  eventReportItemRepo,
  eventReportStatusRepo
)
const eventReportMiddleware = new EventReportMiddleware(
  entityRepo,
  eventReportRepo,
  eventReportStatusRepo,
  eventReportHistoryRepo,
  eventReportReasonRepo
)
const eventReportController = new EventReportController(
  eventReportMiddleware,
  eventReportModule,
  roleMiddleware,
  excelMiddleware
)
// event report status
const eventReportStatusModule = new EventReportStatusModule(
  eventReportStatusRepo
)
const eventReportStatusController = new EventReportStatusController(
  eventReportStatusModule,
  roleMiddleware
)
// event report reason
const eventReportReasonModule = new EventReportReasonModule(
  eventReportReasonRepo
)
const eventReportReasonController = new EventReportReasonController(
  eventReportReasonModule
)

// Order Cancel Reason
const orderCancelReasonModule = new OrderCancelReasonModule(
  orderCancelReasonRepo
)
const orderCancelReasonControler = new OrderCancelReasonController(
  orderCancelReasonModule
)

// Reconciliation Additional
const reconciliationAdditionalModule = new ReconciliationAdditionalModule(
  reconciliationAdditionalRepo
)
const reconciliationAdditionalController =
  new ReconciliationAdditionalController(reconciliationAdditionalModule)

// Reconciliation
const reconciliationRepo = new ReconciliationRepository()
const reconciliationModule = new ReconciliationModule(
  reconciliationRepo,
  exportHistoryRepo,
  publisher
)
const reconciliationMiddleware = new ReconciliationMiddleware(
  reconciliationRepo,
  materialRepo
)
const reconciliationController = new ReconciliationController(
  reconciliationModule,
  reconciliationMiddleware
)
const reconciliationWorker = new ReconciliationWorker(
  reconciliationRepo,
  exportHistoryRepo
)
const reconciliationConsumer = new Consumer(mq, trxManager)
reconciliationWorker.registerWorkers(reconciliationConsumer)

// Transfer Stock
const transferStockRepository = new TransferStockRepository()
const transferStockModule = new TransferStockModule(
  transferStockRepository,
  new EntityRepository(false),
  stockRepo,
  activityRepo,
  new MaterialRepository(false)
)
const transferStockController = new TransferStockController(
  transferStockModule,
  roleMiddleware
)

// Transaction Transfer Stock
const transactionTransferStockRepo = new TransactionTransferStockRepository()
const transactionTransferStockModule = new TransactionTransferStockModule(
  transactionTransferStockRepo,
  stockRepo,
  transactionTypeRepo,
  entityMaterialRepo,
  batchRepo,
  new TransactionTransferStockPublisher(publisher, transactionRepo),
  new EntityMaterialPublisher(publisher)
)
const transactionTransferStockMiddleware =
  new TransactionTransferStockMiddleware(transactionTransferStockRepo)
const transactionTransferStockController =
  new TransactionTransferStockController(
    transactionTransferStockModule,
    transactionTransferStockMiddleware,
    roleMiddleware
  )

// Asset Vendor
const assetVendorMiddleware = new AssetVendorMiddleware(assetVendorRepo)
const assetVendorModule = new AssetVendorModule(assetVendorRepo)
const assetVendorController = new AssetVendorController(
  assetVendorModule,
  assetVendorMiddleware,
  roleMiddleware,
  excelMiddleware
)

// Asset Type
const assetTypeMiddleware = new AssetTypeMiddleware(assetTypeRepo)
const assetTypeModule = new AssetTypeModule(assetTypeRepo)
const assetTypeController = new AssetTypeController(
  assetTypeModule,
  assetTypeMiddleware,
  roleMiddleware,
  excelMiddleware
)

// Asset Model
const assetModelMiddleware = new AssetModelMiddleware(assetModelRepo)
const assetModelModule = new AssetModelModule(assetModelRepo)
const assetModelController = new AssetModelController(
  assetModelModule,
  assetModelMiddleware,
  roleMiddleware,
  excelMiddleware
)

// Asset Working Status
const assetWorkingStatusModule = new AssetWorkingStatusModule(
  assetWorkingStatusRepo
)
const assetWorkingStatusController = new AssetWorkingStatusController(
  assetWorkingStatusModule
)

// Asset Electricity
const assetElectricityModule = new AssetElectricityModule(assetElectricityRepo)
const assetElectricityController = new AssetElectricityController(
  assetElectricityModule
)

// Asset Calibration Schedule
const assetCalibrationScheduleModule = new AssetCalibrationScheduleModule(
  assetCalibrationScheduleRepo
)
const assetCalibrationScheduleController =
  new AssetCalibrationScheduleController(assetCalibrationScheduleModule)

// Asset Maintenance Schedule
const assetMaintenanceScheduleModule = new AssetMaintenanceScheduleModule(
  assetMaintenanceScheduleRepo
)
const assetMaintenanceScheduleController =
  new AssetMaintenanceScheduleController(assetMaintenanceScheduleModule)

// Asset Inventory
const assetInventoryMiddleware = new AssetInventoryMiddleware(
  assetInventoryRepo
)
const assetInventoryModule = new AssetInventoryModule(assetInventoryRepo)
const assetInventoryController = new AssetInventoryController(
  assetInventoryModule,
  assetInventoryMiddleware,
  excelMiddleware
)

// Logger
const loggerModule = new LoggerModule(loggerRepo)
const loggerController = new LoggerController(loggerModule)

// Logger History
const loggerHistoryRepo = new LoggerHistoryRepository()
const loggerHistoryModule = new LoggerHistoryModule(loggerHistoryRepo)
const loggerHistoryController = new LoggerHistoryController(
  loggerHistoryRepo,
  assetInventoryRepo
)

// Disposal
const disposalRepo = new DisposalStockRepository()
const disposalModule = new DisposalStockModule(
  disposalRepo,
  entityRepo,
  materialRepo
)
const disposalController = new DisposalStockController(
  disposalModule,
  new DisposalStockMiddleware(),
  roleMiddleware,
  excelMiddleware
)

// disposal
const disposalShipmentRepo = new DisposalShipmentRepository(
  entityMaterialRepo,
  stockRepo
)

const disposalShipmentModule = new DisposalShipmentModule(disposalShipmentRepo)

const disposalShipmentController = new DisposalShipmentController(
  disposalShipmentModule,
  new DisposalShipmentMiddleware(),
  roleMiddleware,
  excelMiddleware
)

const protocolRepository = new ProtocolRepository()
const protocolModule = new ProtocolModule(protocolRepository)
const protocolController = new ProtocolController(protocolModule)

const stockLoggingRepo = new StockLoggingRepository()
const stockLoggingModule = new StockLoggingModule(stockLoggingRepo, stockRepo)
const stockLoggingController = new StockLoggingController(stockLoggingModule)

// Transaction Consumption
// Transaction - Rabies
const consumptionRepo = new ConsumptionRepository()

const consumptionModule = new ConsumptionModule(
  consumptionRepo,
  stockRepo,
  batchRepo,
  new TransactionPublisher(publisher, transactionRepo)
)
const consumptionMiddleware = new ConsumptionMiddleware(
  consumptionRepo,
  transactionRepo,
  activityRepo,
  entityActivityRepository
)
const consumptionController = new ConsumptionController(
  consumptionModule,
  consumptionMiddleware
)

// Immunization Logistics
const immunizationLogisticsRepo = new ImmunizationLogisticsRepository()
const immunizationLogisticsModule = new ImmunizationLogisticsModule(
  targetEstimationNonBiasRepo,
  materialRepo,
  immunizationLogisticsRepo,
  targetsRepo
)
const immunizationLogisticsController = new ImmunizationLogisticsController(
  immunizationLogisticsModule
)

// Bias Immunization Logistics
const biasImmunizationLogisticsRepo = new BiasImmunizationLogisticsRepository()
const biasImmunizationLogisticsModule = new BiasImmunizationLogisticsModule(
  targetEstimationBiasRepo,
  materialRepo,
  materialTargetsRepository,
  biasImmunizationLogisticsRepo,
  targetsRepo,
  stockRepo
)
const biasImmunizationLogisticsController =
  new BiasImmunizationLogisticsController(
    biasImmunizationLogisticsModule,
    trxMiddleware
  )

// Non-Bias Immunization Logistics
const nonBiasImmunizationLogisticsRepo =
  new NonBiasImmunizationLogisticsRepository()
const nonBiasImmunizationLogisticsModule =
  new NonBiasImmunizationLogisticsModule(
    targetEstimationNonBiasRepo,
    materialRepo,
    materialTargetsRepository,
    nonBiasImmunizationLogisticsRepo,
    targetsRepo,
    stockRepo
  )
const nonBiasImmunizationLogisticsController =
  new NonBiasImmunizationLogisticsController(
    nonBiasImmunizationLogisticsModule,
    trxMiddleware
  )

// Annual Planning Program Plan
const annualPlanningProgramPlanRepo = new AnnualPlanningProgramPlanRepository()
const annualPlanningProgramPlanModule = new AnnualPlanningProgramPlanModule(
  annualPlanningProgramPlanRepo
)
const annualPlanningProgramPlanMiddleware =
  new AnnualPlanningProgramPlanMiddleware(annualPlanningProgramPlanRepo)
const annualPlanningProgramPlanController =
  new AnnualPlanningProgramPlanController(
    annualPlanningProgramPlanModule,
    annualPlanningProgramPlanMiddleware
  )

// Annual Planning Material Substitution
const annualPlanningMaterialSubstitutionRepo =
  new AnnualPlanningMaterialSubstitutionRepository()
const annualPlanningMaterialSubstitutionModule =
  new AnnualPlanningMaterialSubstitutionModule(
    annualPlanningMaterialSubstitutionRepo,
    annualPlanningProgramPlanRepo
  )
const annualPlanningMaterialSubstitutionMiddleware =
  new AnnualPlanningMaterialSubstitutionMiddleware(
    annualPlanningMaterialSubstitutionRepo
  )
const annualPlanningMaterialSubstitutionController =
  new AnnualPlanningMaterialSubstitutionController(
    annualPlanningMaterialSubstitutionModule,
    annualPlanningMaterialSubstitutionMiddleware,
    excelMiddleware
  )

const materialSubtypeRepo = new MaterialSubtypeRepository()
const materialSubtypeModule = new MaterialSubtypeModule(materialSubtypeRepo)
const materialSubtypeController = new MaterialSubtypeController(
  materialSubtypeModule
)

const materialRatioRepo = new MaterialRatioRepository()
const materialRatioModule = new MaterialRatioModule(materialRatioRepo, userRepo)
const materialRatioValidator = new MaterialRatioValidator(
  annualPlanningProgramPlanRepo,
  materialRepo,
  materialSubtypeRepo
)
const materialRatioMiddleware = new MaterialRatioMiddleware(
  materialRatioValidator
)
const materialRatioController = new MaterialRatioController(
  materialRatioModule,
  materialRatioMiddleware
)

const materialRatioExcelRepo = new MaterialRatioExcelRepository()
const materialRatioExcelMiddleware = new MaterialRatioExcelMiddleware(
  materialRatioValidator
)
const materialRatioExcelModule = new MaterialRatioExcelModule(
  materialSubtypeRepo,
  materialRepo,
  materialRatioExcelRepo,
  userRepo,
  annualPlanningProgramPlanRepo
)
const materialRatioExcelController = new MaterialRatioExcelController(
  materialRatioExcelModule,
  excelMiddleware,
  materialRatioExcelMiddleware
)

const taskRepo = new TaskRepository()
const taskModule = new TaskModule(taskRepo, userRepo, locationRepo)
const taskMiddleware = new TaskMiddleware(
  materialRepo,
  activityRepo,
  annualPlanningProgramPlanRepo,
  targetGroupsRepo,
  locationRepo
)
const taskController = new TaskController(taskModule, taskMiddleware)

const taskExcelRepo = new TaskExcelRepository(taskRepo)
const taskExcelModule = new TaskExcelModule(
  annualPlanningProgramPlanRepo,
  materialRepo,
  activityRepo,
  targetGroupsRepo,
  locationRepo,
  taskExcelRepo,
  userRepo
)
const taskExcelMiddleware = new TaskExcelMiddleware(
  materialRepo,
  activityRepo,
  annualPlanningProgramPlanRepo,
  targetGroupsRepo,
  locationRepo
)
const taskExcelController = new TaskExcelController(
  taskExcelModule,
  excelMiddleware,
  taskExcelMiddleware
)

const populationRepo = new PopulationRepository()
const populationModule = new PopulationModule(populationRepo, userRepo)
const populationController = new PopulationController(populationModule)

// Annual Planning Program Plan Group Target
const annualPlanningGroupTargetRepo = new AnnualPlanningGroupTargetRepository()
const annualPlanningGroupTargetModule = new AnnualPlanningGroupTargetModule(
  annualPlanningGroupTargetRepo
)
const annualPlanningGroupTargetMiddleware =
  new AnnualPlanningGroupTargetMiddleware(annualPlanningGroupTargetRepo)
const annualPlanningGroupTargetController =
  new AnnualPlanningGroupTargetController(
    annualPlanningGroupTargetModule,
    annualPlanningGroupTargetMiddleware
  )

// Annual Needs

const annualNeedsRepo = new AnnualNeedRepository()
const annualNeedsModule = new AnnualNeedModule(annualNeedsRepo)
const annualNeedMiddleware = new AnnualNeedMiddleware(annualNeedsRepo)
const annualNeedsController = new AnnualNeedController(
  annualNeedsModule,
  annualNeedMiddleware
)

// Immunization
const immunizationRepo = new ImmunizationRepository()

const immunizationModule = new ImmunizationModule(
  immunizationRepo,
  locationRepo,
  targetsRepo
)

const immunizationMiddleware = new ImmunizationMiddleware(
  immunizationRepo,
  locationRepo
)

const immunizationController = new ImmunizationController(
  immunizationModule,
  immunizationMiddleware
)

// Dengue Case
const dengueCaseRepo = new DengueCaseRepository()

const dengueCaseModule = new DengueCaseModule(dengueCaseRepo, locationRepo)

const dengueCaseMiddleware = new DengueCaseMiddleware(
  locationRepo,
  dengueCaseRepo,
  entityRepo
)

const dengueCaseController = new DengueCaseController(
  dengueCaseModule,
  dengueCaseMiddleware,
  excelMiddleware
)

// Dengue Sentinel Surveillance
const sentinelSurveillanceRepo = new SentinelSurveillanceRepository()

const sentinelSurveillanceModule = new SentinelSurveillanceModule(
  sentinelSurveillanceRepo
)

const sentinelSurveillanceMiddleware = new SentinelSurveillanceMiddleware(
  sentinelSurveillanceRepo
)

const sentinelSurveillanceController = new SentinelSurveillanceController(
  sentinelSurveillanceModule,
  sentinelSurveillanceMiddleware
)

// Annual Commitment
const annualCommitmentMiddleware = new AnnualCommitmentMiddleware(
  annualCommitmentRepo
)
const annualCommitmentModule = new AnnualCommitmentModule(annualCommitmentRepo)
const annualCommitmentController = new AnnualCommitmentController(
  annualCommitmentModule,
  annualCommitmentMiddleware,
  roleMiddleware,
  excelMiddleware
)

// Emonev
const emonevModule = new EmonevModule(emonevRepo)
const emonevController = new EmonevController(emonevModule)

// Main App routes
const mainApp = new Hono()
mainApp.use(cors())

// Notifications route (bypasses authentication for public routes)
const notificationPublicRoutes = new Hono()
notificationPublicRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("loadSlaveDB"),
  commonMiddleware.loadSlaveDB
)
notificationPublicRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("requestMiddleware"),
  requestMiddleware.handle
)
notificationPublicRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("evtMiddleware"),
  evtMiddleware.handle
)
notificationPublicRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("trxMiddleware"),
  trxMiddleware.handle
)
notificationPublicRoutes.use(
  "*",
  routeTracer.traceRoute("notifications-public")
)
notificationPublicRoutes.route("/", notificationController.getPublicRoutes())
mainApp.route("/notifications", notificationPublicRoutes)

// Global middlewares
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("loadSlaveDB"),
  commonMiddleware.loadSlaveDB
)
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("requestMiddleware"),
  requestMiddleware.handle
)
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("featureFlagsMiddleware"),
  featureFlagsMiddleware()
)
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("loadProgramId"),
  commonMiddleware.loadProgramId
)
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("evtMiddleware"),
  evtMiddleware.handle
)
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("trxMiddleware"),
  trxMiddleware.handle
)
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("authKeycloakMiddleware"),
  authKeycloakMiddleware.handleAuthKeycloak
)
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("roleMiddleware"),
  roleMiddleware.handle(rolesToResourceMappingRepo)
)
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("authMiddleware"),
  authMiddleware.handleAuthHeaderReinjection
)

// Notifications route (with authentication)
const notificationAuthenticatedRoutes = new Hono()
notificationAuthenticatedRoutes.use(
  "*",
  routeTracer.traceRoute("notifications-authenticated")
)
notificationAuthenticatedRoutes.route(
  "/",
  notificationController.getAuthenticatedRoutes()
)
mainApp.route("/notifications", notificationAuthenticatedRoutes)

// Materials routes with tracing
const materialsRoutes = new Hono()
materialsRoutes.use("*", routeTracer.traceRoute("materials"))
materialsRoutes.route("/", materialController.getRoutes())
mainApp.route("/materials", materialsRoutes)

// Entity materials routes with tracing
const entityMaterialRoutes = new Hono()
entityMaterialRoutes.use("*", routeTracer.traceRoute("entity-materials"))
entityMaterialRoutes.route("/", entityMaterialController.getRoutes())
mainApp.route("/entities", entityMaterialRoutes)

// Activities routes with tracing
const activitiesRoutes = new Hono()
activitiesRoutes.use("*", routeTracer.traceRoute("activities"))
activitiesRoutes.route("/", activityController.getRoutes())
mainApp.route("/activities", activitiesRoutes)

// Activities v2 routes with tracing
const activitiesV2Routes = new Hono()
activitiesV2Routes.use("*", routeTracer.traceRoute("activities-v2"))
activitiesV2Routes.route("/", activityController.getRoutes())
mainApp.route("/v2", activitiesV2Routes)

// Entity materials bulk routes with tracing
const entityMaterialsBulkRoutes = new Hono()
entityMaterialsBulkRoutes.use(
  "*",
  routeTracer.traceRoute("entities-materials-bulk")
)
entityMaterialsBulkRoutes.route("/", entityMaterialExcelController.getRoutes())
mainApp.route("/entities-materials-bulk", entityMaterialsBulkRoutes)
// Entity routes with tracing
const entitiesRoutes = new Hono()
entitiesRoutes.use("*", routeTracer.traceRoute("entities"))
entitiesRoutes.route("/", entityController.getRoutes())
mainApp.route("/entities", entitiesRoutes)

// Entity customers routes with tracing
const entityCustomersRoutes = new Hono()
entityCustomersRoutes.use("*", routeTracer.traceRoute("entity-customers"))
entityCustomersRoutes.route("/", entityCustomerController.getRoutes())
mainApp.route("/entities", entityCustomersRoutes)

// Entity vendors routes with tracing
const entityVendorsRoutes = new Hono()
entityVendorsRoutes.use("*", routeTracer.traceRoute("entity-vendors"))
entityVendorsRoutes.route("/", entityVendorController.getRoutes())
mainApp.route("/entities", entityVendorsRoutes)

// Entity users routes with tracing
const entityUsersRoutes = new Hono()
entityUsersRoutes.use("*", routeTracer.traceRoute("entity-users"))
entityUsersRoutes.route("/", entityUserController.getRoutes())
mainApp.route("/entities", entityUsersRoutes)

// Entity activities routes with tracing
const entityActivitiesRoutes = new Hono()
entityActivitiesRoutes.use("*", routeTracer.traceRoute("entity-activities"))
entityActivitiesRoutes.route("/", entityActivityController.getRoutes())
mainApp.route("/entities", entityActivitiesRoutes)

// Entity schools routes with tracing
const entitySchoolsRoutes = new Hono()
entitySchoolsRoutes.use("*", routeTracer.traceRoute("schools"))
entitySchoolsRoutes.route("/", entitySchoolController.getRoutes())
mainApp.route("/schools", entitySchoolsRoutes)

// Material targets routes with tracing
const materialTargetsRoutes = new Hono()
materialTargetsRoutes.use("*", routeTracer.traceRoute("material-targets"))
materialTargetsRoutes.route("/", materialTargetsController.getRoutes())
mainApp.route("/material-targets", materialTargetsRoutes)

// Entity tags routes with tracing
const entityTagsRoutes = new Hono()
entityTagsRoutes.use("*", routeTracer.traceRoute("entity-tags"))
entityTagsRoutes.route("/", entityTagController.getRoutes())
mainApp.route("/entity-tags", entityTagsRoutes)

// Entity types routes with tracing
const entityTypesRoutes = new Hono()
entityTypesRoutes.use("*", routeTracer.traceRoute("entity-types"))
entityTypesRoutes.route("/", entityTypeController.getRoutes())
mainApp.route("/entity-types", entityTypesRoutes)
// Provinces routes with tracing
const provincesRoutes = new Hono()
provincesRoutes.use("*", routeTracer.traceRoute("provinces"))
provincesRoutes.route("/", provinceController.getRoutes())
mainApp.route("/provinces", provincesRoutes)

// Regencies routes with tracing
const regenciesRoutes = new Hono()
regenciesRoutes.use("*", routeTracer.traceRoute("regencies"))
regenciesRoutes.route("/", regencyController.getRoutes())
mainApp.route("/regencies", regenciesRoutes)

// Subdistricts routes with tracing
const subdistrictsRoutes = new Hono()
subdistrictsRoutes.use("*", routeTracer.traceRoute("subdistricts"))
subdistrictsRoutes.route("/", subDistrictController.getRoutes())
mainApp.route("/subdistricts", subdistrictsRoutes)

// Villages routes with tracing
const villagesRoutes = new Hono()
villagesRoutes.use("*", routeTracer.traceRoute("villages"))
villagesRoutes.route("/", villageController.getRoutes())
mainApp.route("/villages", villagesRoutes)
// Users routes with tracing
const usersRoutes = new Hono()
usersRoutes.use("*", routeTracer.traceRoute("users"))
usersRoutes.route("/", userController.getRoutes())
mainApp.route("/users", usersRoutes)

// Budget sources routes with tracing
const budgetSourcesRoutes = new Hono()
budgetSourcesRoutes.use("*", routeTracer.traceRoute("budget-sources"))
budgetSourcesRoutes.route("/", budgetSourceController.getRoutes())
mainApp.route("/budget-sources", budgetSourcesRoutes)

// Manufactures routes with tracing
const manufacturesRoutes = new Hono()
manufacturesRoutes.use("*", routeTracer.traceRoute("manufactures"))
manufacturesRoutes.route("/", manufactureController.getRoutes())
mainApp.route("/manufactures", manufacturesRoutes)
// Orders routes with tracing
const ordersRoutes = new Hono()
ordersRoutes.use("*", routeTracer.traceRoute("orders"))
ordersRoutes.route("/", orderControler.getRoutes())
mainApp.route("/orders", ordersRoutes)

// Order returns routes with tracing
const orderReturnsRoutes = new Hono()
orderReturnsRoutes.use("*", routeTracer.traceRoute("order-returns"))
orderReturnsRoutes.route("/", orderReturnController.getRoutes())
mainApp.route("/orders", orderReturnsRoutes)

// Order comments routes with tracing
const orderCommentsRoutes = new Hono()
orderCommentsRoutes.use("*", routeTracer.traceRoute("order-comments"))
orderCommentsRoutes.route("/", orderCommentController.getRoutes())
mainApp.route("/orders", orderCommentsRoutes)

// Order item stock routes with tracing
const orderItemStockRoutes = new Hono()
orderItemStockRoutes.use("*", routeTracer.traceRoute("order-item-stock"))
orderItemStockRoutes.route("/", orderItemStockController.getRoutes())
mainApp.route("/orders", orderItemStockRoutes)

// Order status pending routes with tracing
const orderStatusPendingRoutes = new Hono()
orderStatusPendingRoutes.use(
  "*",
  routeTracer.traceRoute("order-status-pending")
)
orderStatusPendingRoutes.route("/", orderStatusPendingController.getRoutes())
mainApp.route("/orders", orderStatusPendingRoutes)
// Order status validate routes with tracing
const orderStatusValidateRoutes = new Hono()
orderStatusValidateRoutes.use(
  "*",
  routeTracer.traceRoute("order-status-validate")
)
orderStatusValidateRoutes.route("/", orderStatusValidateController.getRoutes())
mainApp.route("/orders", orderStatusValidateRoutes)

// Order status confirm routes with tracing
const orderStatusConfirmRoutes = new Hono()
orderStatusConfirmRoutes.use(
  "*",
  routeTracer.traceRoute("order-status-confirm")
)
orderStatusConfirmRoutes.route("/", orderStatusConfirmController.getRoutes())
mainApp.route("/orders", orderStatusConfirmRoutes)

// Order status allocate routes with tracing
const orderStatusAllocateRoutes = new Hono()
orderStatusAllocateRoutes.use(
  "*",
  routeTracer.traceRoute("order-status-allocate")
)
orderStatusAllocateRoutes.route("/", orderStatusAllocateController.getRoutes())
mainApp.route("/orders", orderStatusAllocateRoutes)

// Order status ship routes with tracing
const orderStatusShipRoutes = new Hono()
orderStatusShipRoutes.use("*", routeTracer.traceRoute("order-status-ship"))
orderStatusShipRoutes.route("/", orderStatusShipController.getRoutes())
mainApp.route("/orders", orderStatusShipRoutes)

// Order status fulfilled routes with tracing
const orderStatusFulfilledRoutes = new Hono()
orderStatusFulfilledRoutes.use(
  "*",
  routeTracer.traceRoute("order-status-fulfilled")
)
orderStatusFulfilledRoutes.route(
  "/",
  orderStatusFulfilledController.getRoutes()
)
mainApp.route("/orders", orderStatusFulfilledRoutes)

// Order status cancel routes with tracing
const orderStatusCancelRoutes = new Hono()
orderStatusCancelRoutes.use("*", routeTracer.traceRoute("order-status-cancel"))
orderStatusCancelRoutes.route("/", orderStatusCancelController.getRoutes())
mainApp.route("/orders", orderStatusCancelRoutes)
// Order reasons routes with tracing
const orderReasonsRoutes = new Hono()
orderReasonsRoutes.use("*", routeTracer.traceRoute("order-reasons"))
orderReasonsRoutes.route("/", orderReasonControler.getRoutes())
mainApp.route("/order-reasons", orderReasonsRoutes)

// Batches routes with tracing
const batchesRoutes = new Hono()
batchesRoutes.use("*", routeTracer.traceRoute("batches"))
batchesRoutes.route("/", batchController.getRoutes())
mainApp.route("/batches", batchesRoutes)

// Order allocation routes with tracing
const orderAllocationRoutes = new Hono()
orderAllocationRoutes.use("*", routeTracer.traceRoute("order-allocation"))
orderAllocationRoutes.route("/", orderAllocationController.getRoutes())
mainApp.route("/orders", orderAllocationRoutes)

// Order central delivery routes with tracing
const orderCentralDeliveryRoutes = new Hono()
orderCentralDeliveryRoutes.use(
  "*",
  routeTracer.traceRoute("order-central-delivery")
)
orderCentralDeliveryRoutes.route(
  "/",
  orderCentralDeliveryController.getRoutes()
)
mainApp.route("/orders", orderCentralDeliveryRoutes)

// Order relocation routes with tracing
const orderRelocationRoutes = new Hono()
orderRelocationRoutes.use("*", routeTracer.traceRoute("order-relocation"))
orderRelocationRoutes.route("/", orderRelocationController.getRoutes())
mainApp.route("/orders", orderRelocationRoutes)

// Contracts routes with tracing
const contractsRoutes = new Hono()
contractsRoutes.use("*", routeTracer.traceRoute("contracts"))
contractsRoutes.route("/", contractController.getRoutes())
mainApp.route("/contracts", contractsRoutes)

// Order cancel reasons routes with tracing
const orderCancelReasonsRoutes = new Hono()
orderCancelReasonsRoutes.use(
  "*",
  routeTracer.traceRoute("order-cancel-reasons")
)
orderCancelReasonsRoutes.route("/", orderCancelReasonControler.getRoutes())
mainApp.route("/order-cancel-reasons", orderCancelReasonsRoutes)

// Event Report routes with tracing
const eventReportStatusRoutes = new Hono()
eventReportStatusRoutes.use("*", routeTracer.traceRoute("event-report-status"))
eventReportStatusRoutes.route("/", eventReportStatusController.getRoutes())
mainApp.route("/event-report", eventReportStatusRoutes)

const eventReportReasonRoutes = new Hono()
eventReportReasonRoutes.use("*", routeTracer.traceRoute("event-report-reason"))
eventReportReasonRoutes.route("/", eventReportReasonController.getRoutes())
mainApp.route("/event-report", eventReportReasonRoutes)

const eventReportRoutes = new Hono()
eventReportRoutes.use("*", routeTracer.traceRoute("event-report"))
eventReportRoutes.route("/", eventReportController.getRoutes())
mainApp.route("/event-report", eventReportRoutes)

// IOTx routes with tracing
const stockOpnamePeriodsRoutes = new Hono()
stockOpnamePeriodsRoutes.use(
  "*",
  routeTracer.traceRoute("stock-opname-periods")
)
stockOpnamePeriodsRoutes.route("/", stockOpnamePeriodController.getRoutes())
mainApp.route("/stock-opname-periods", stockOpnamePeriodsRoutes)

const stockOpnamesRoutes = new Hono()
stockOpnamesRoutes.use("*", routeTracer.traceRoute("stock-opnames"))
stockOpnamesRoutes.route("/", stockOpnameController.getRoutes())
mainApp.route("/stock-opnames", stockOpnamesRoutes)

const stocksRoutes = new Hono()
stocksRoutes.use("*", routeTracer.traceRoute("stocks"))
stocksRoutes.route("/", stockController.getRoutes())
mainApp.route("/stocks", stocksRoutes)

const stockQualitiesRoutes = new Hono()
stockQualitiesRoutes.use("*", routeTracer.traceRoute("stock-qualities"))
stockQualitiesRoutes.route("/", stockQualityController.getRoutes())
mainApp.route("/stock-qualities", stockQualitiesRoutes)

const stockConsumptionsRoutes = new Hono()
stockConsumptionsRoutes.use("*", routeTracer.traceRoute("stock-consumptions"))
stockConsumptionsRoutes.route("/", stockConsumptionController.getRoutes())
mainApp.route("/stock-consumptions", stockConsumptionsRoutes)

const transactionsRoutes = new Hono()
transactionsRoutes.use("*", routeTracer.traceRoute("transactions"))
transactionsRoutes.route("/", transactionController.getRoutes())
transactionsRoutes.route("/", transactionDetailController.getRoutes())
mainApp.route("/transactions", transactionsRoutes)

// transaction consumption
const consumptionRoutes = new Hono()
consumptionRoutes.use("*", routeTracer.traceRoute("consumption"))
consumptionRoutes.route("/", consumptionController.getRoutes())
mainApp.route("/transactions", consumptionRoutes)

const consumptionReactionRoutes = new Hono()
consumptionReactionRoutes.use(
  "*",
  routeTracer.traceRoute("consumption-reaction")
)
consumptionReactionRoutes.route("/", consumptionReactionController.getRoutes())
mainApp.route("/consumptions", consumptionReactionRoutes)

const patientRoutes = new Hono()
patientRoutes.use("*", routeTracer.traceRoute("patient"))
patientRoutes.route("/", patientController.getRoutes())
mainApp.route("/consumptions", patientRoutes)

const targetsRoutesHono = new Hono()
targetsRoutesHono.use(
  "*",
  featureGuardMiddleware("feature.microplanning", { defaultEnabled: false })
)
targetsRoutesHono.use("*", routeTracer.traceRoute("targets"))
targetsRoutesHono.route("/", targetsController.getRoutes())
mainApp.route("/microplanning", targetsRoutesHono)

const microplanningRoutes = new Hono()
microplanningRoutes.use(
  "*",
  featureGuardMiddleware("feature.microplanning", { defaultEnabled: false })
)
microplanningRoutes.use("*", routeTracer.traceRoute("microplanning"))
microplanningRoutes.route("/", microplanningController.getRoutes())
mainApp.route("/microplanning/overview", microplanningRoutes)

const targetEstimationRoutes = new Hono()
targetEstimationRoutes.use(
  "*",
  featureGuardMiddleware("feature.microplanning", { defaultEnabled: false })
)
targetEstimationRoutes.use("*", routeTracer.traceRoute("target-estimation"))
targetEstimationRoutes.route("/", targetEstimationController.getRoutes())
mainApp.route("/microplanning/estimation", targetEstimationRoutes)

const microplanningDashboardRoutes = new Hono()
microplanningDashboardRoutes.use(
  "*",
  featureGuardMiddleware("feature.microplanning", { defaultEnabled: false })
)
microplanningDashboardRoutes.use(
  "*",
  routeTracer.traceRoute("microplanning-dashboard")
)
microplanningDashboardRoutes.route(
  "/",
  microplanningDashboardController.getRoutes()
)
mainApp.route("/microplanning/dashboard", microplanningDashboardRoutes)

const transactionTransferStockRoutes = new Hono()
transactionTransferStockRoutes.use(
  "*",
  routeTracer.traceRoute("transaction-transfer-stock")
)
transactionTransferStockRoutes.route(
  "/",
  transactionTransferStockController.getRoutes()
)
mainApp.route("/transactions", transactionTransferStockRoutes)

const sismalRoutes = new Hono()
sismalRoutes.use("*", routeTracer.traceRoute("sismal"))
sismalRoutes.route("/", sismalController.getRoutes())
mainApp.route("/sismal", sismalRoutes)

// Reconciliation Additional routes with tracing
const reconciliationAdditionalRoutes = new Hono()
reconciliationAdditionalRoutes.use(
  "*",
  routeTracer.traceRoute("reconciliation-additional")
)
reconciliationAdditionalRoutes.route(
  "/",
  reconciliationAdditionalController.getRoutes()
)
mainApp.route("/reconciliation", reconciliationAdditionalRoutes)

// Reconciliation routes with tracing
const reconciliationRoutes = new Hono()
reconciliationRoutes.use("*", routeTracer.traceRoute("reconciliation"))
reconciliationRoutes.route("/", reconciliationController.getRoutes())
mainApp.route("/reconciliation", reconciliationRoutes)

// Transfer Stock routes with tracing
const transferStockRoutes = new Hono()
transferStockRoutes.use("*", routeTracer.traceRoute("transfer-stock"))
transferStockRoutes.route("/", transferStockController.getRoutes())
mainApp.route("/transfer-stock", transferStockRoutes)

// App mobile data routes with tracing
const appMobileDataRoutes = new Hono()
appMobileDataRoutes.use("*", routeTracer.traceRoute("app-mobile-data"))
appMobileDataRoutes.route("/", appMobileDataController.getRoutes())
mainApp.route("/app/data", appMobileDataRoutes)

// App mobile notif routes with tracing
const appMobileNotifRoutes = new Hono()
appMobileNotifRoutes.use("*", routeTracer.traceRoute("app-mobile-notif"))
appMobileNotifRoutes.route("/", appMobileNotifController.getRoutes())
mainApp.route("/app/notif", appMobileNotifRoutes)

// Sync Example routes with tracing
const syncExampleRoutes = new Hono()
syncExampleRoutes.use("*", routeTracer.traceRoute("sync-example"))
syncExampleRoutes.route("/", syncExampleController.getRoutes())
mainApp.route("/sync-example", syncExampleRoutes)

// Testing tolgee translation
mainApp.get("/tolgee/:key", async (c) => {
  await i18n.loadResources(await loadResources())
  const key = c.req.param("key") ?? ""
  const value = c.var.t(key)

  return c.json({ value }, 200)
})

// Asset routes with tracing
const assetVendorsRoutes = new Hono()
assetVendorsRoutes.use("*", routeTracer.traceRoute("asset-vendors"))
assetVendorsRoutes.route("/", assetVendorController.getRoutes())
mainApp.route("/asset-vendors", assetVendorsRoutes)

const assetTypesRoutes = new Hono()
assetTypesRoutes.use("*", routeTracer.traceRoute("asset-types"))
assetTypesRoutes.route("/", assetTypeController.getRoutes())
mainApp.route("/asset-types", assetTypesRoutes)

const assetModelsRoutes = new Hono()
assetModelsRoutes.use("*", routeTracer.traceRoute("asset-models"))
assetModelsRoutes.route("/", assetModelController.getRoutes())
mainApp.route("/asset-models", assetModelsRoutes)

const assetWorkingStatusesRoutes = new Hono()
assetWorkingStatusesRoutes.use(
  "*",
  routeTracer.traceRoute("asset-working-statuses")
)
assetWorkingStatusesRoutes.route("/", assetWorkingStatusController.getRoutes())
mainApp.route("/asset-working-statuses", assetWorkingStatusesRoutes)

const assetElectricitiesRoutes = new Hono()
assetElectricitiesRoutes.use("*", routeTracer.traceRoute("asset-electricities"))
assetElectricitiesRoutes.route("/", assetElectricityController.getRoutes())
mainApp.route("/asset-electricities", assetElectricitiesRoutes)

const assetCalibrationSchedulesRoutes = new Hono()
assetCalibrationSchedulesRoutes.use(
  "*",
  routeTracer.traceRoute("asset-calibration-schedules")
)
assetCalibrationSchedulesRoutes.route(
  "/",
  assetCalibrationScheduleController.getRoutes()
)
mainApp.route("/asset-calibration-schedules", assetCalibrationSchedulesRoutes)

const assetMaintenanceSchedulesRoutes = new Hono()
assetMaintenanceSchedulesRoutes.use(
  "*",
  routeTracer.traceRoute("asset-maintenance-schedules")
)
assetMaintenanceSchedulesRoutes.route(
  "/",
  assetMaintenanceScheduleController.getRoutes()
)
mainApp.route("/asset-maintenance-schedules", assetMaintenanceSchedulesRoutes)

const assetInventoriesRoutes = new Hono()
assetInventoriesRoutes.use("*", routeTracer.traceRoute("asset-inventories"))
assetInventoriesRoutes.route("/", assetInventoryController.getRoutes())
mainApp.route("/asset-inventories", assetInventoriesRoutes)

// Logger routes with tracing
const loggerRoutes = new Hono()
loggerRoutes.use("*", routeTracer.traceRoute("loggers"))
loggerRoutes.route("/", loggerController.getRoutes())
mainApp.route("/loggers", loggerRoutes)

// Isolated Disposal Instruction routes with tracing (completely separate from other disposal routes)
const disposalInstructionRoutes = new Hono()
disposalInstructionRoutes.use(
  "*",
  routeTracer.traceRoute("disposal-instructions")
)
disposalInstructionRoutes.route(
  "/disposal/instructions",
  disposalInstructionController.getRoutes()
)
mainApp.route("/", disposalInstructionRoutes)

// Logger History routes with tracing
const loggerHistoryRoutes = new Hono()
loggerHistoryRoutes.use("*", routeTracer.traceRoute("logger-histories"))
loggerHistoryRoutes.route("/", loggerHistoryController.getRoutes())
mainApp.route("/logger-histories", loggerHistoryRoutes)

// Disposal routes with tracing
const disposalRoutes = new Hono()
disposalRoutes.use("*", routeTracer.traceRoute("disposal"))
disposalRoutes.route("/", disposalController.getRoutes())
mainApp.route("/disposal", disposalRoutes)

const disposalShipmentRoutes = new Hono()
disposalShipmentRoutes.use("*", routeTracer.traceRoute("disposal-shipment"))
disposalShipmentRoutes.route("/", disposalShipmentController.getRoutes())
mainApp.route("/disposal/shipment", disposalShipmentRoutes)

const disposalMethodsRoutes = new Hono()
disposalMethodsRoutes.use("*", routeTracer.traceRoute("disposal-methods"))
disposalMethodsRoutes.route("/", disposalMethodsController.getRoutes())
mainApp.route("/disposal/methods", disposalMethodsRoutes)

const selfDisposalRoutes = new Hono()
selfDisposalRoutes.use("*", routeTracer.traceRoute("self-disposal"))
selfDisposalRoutes.route("/", selfDisposalController.getRoutes())
mainApp.route("/disposal", selfDisposalRoutes)

// Feature flags webhook routes (public - bypasses auth for external webhooks)
const featureFlagsWebhookRoutes = new Hono()
featureFlagsWebhookRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("loadSlaveDB"),
  commonMiddleware.loadSlaveDB
)
featureFlagsWebhookRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("requestMiddleware"),
  requestMiddleware.handle
)
featureFlagsWebhookRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("evtMiddleware"),
  evtMiddleware.handle
)
featureFlagsWebhookRoutes.use(
  "*",
  middlewareTracer.traceMiddleware("feature-flags-webhook"),
  routeTracer.traceRoute("feature-flags-webhook")
)
featureFlagsWebhookRoutes.post("/webhook", createWebhookHandler())
featureFlagsWebhookRoutes.post("/refresh", createRefreshHandler())
mainApp.route("/feature-flags", featureFlagsWebhookRoutes)

// tolgee
const tolgeeConsumer = new Consumer(getConnection, trxManager, randomUUID())
tolgeeConsumer.route(TOPIC.TOLGEE_RELOADED, async () => {
  await reloadTranslations()
})

const protocolRoutes = new Hono()
protocolRoutes.use("*", routeTracer.traceRoute("protocols"))
protocolRoutes.route("/", protocolController.getRoutes())
mainApp.route("/protocols", protocolRoutes)

// Stock Logging route
const stockLoggingRoutes = new Hono()
stockLoggingRoutes.use("*", routeTracer.traceRoute("stock-logging"))
stockLoggingRoutes.route("/", stockLoggingController.getRoutes())
mainApp.route("/stock-logging", stockLoggingRoutes)

// Annual Planning Material Substitution route
const annualPlanningMaterialSubstitutionRoutes = new Hono()
annualPlanningMaterialSubstitutionRoutes.use(
  "*",
  routeTracer.traceRoute("annual-planning-material-substitution")
)
annualPlanningMaterialSubstitutionRoutes.route(
  "/",
  annualPlanningMaterialSubstitutionController.getRoutes()
)
mainApp.route(
  "/annual-planning/program-plans",
  annualPlanningMaterialSubstitutionRoutes
)

// Annual Planning Material Ratio route
const annualPlanningMaterialRatioRoutes = new Hono()
annualPlanningMaterialRatioRoutes.use(
  "*",
  routeTracer.traceRoute("annual-planning-material-ratio")
)
annualPlanningMaterialRatioRoutes.route(
  "/",
  materialRatioExcelController.getRoutes()
)
annualPlanningMaterialRatioRoutes.route(
  "/",
  materialRatioController.getRoutes()
)
mainApp.route(
  "/annual-planning/program-plans",
  annualPlanningMaterialRatioRoutes
)

// Annual Planning Population route
const annualPlanningPopulationRoutes = new Hono()
annualPlanningPopulationRoutes.use(
  "*",
  routeTracer.traceRoute("annual-planning-population")
)
annualPlanningPopulationRoutes.route("/", populationController.getRoutes())
mainApp.route("/annual-planning/program-plans", annualPlanningPopulationRoutes)

// Annual Planning Task route
const annualPlanningTaskRoutes = new Hono()
annualPlanningTaskRoutes.use(
  "*",
  routeTracer.traceRoute("annual-planning-task")
)
annualPlanningTaskRoutes.route("/", taskExcelController.getRoutes())
annualPlanningTaskRoutes.route("/", taskController.getRoutes())
mainApp.route("/annual-planning/program-plans", annualPlanningTaskRoutes)

// Material Subtype
const materialSubtypeRoutes = new Hono()
materialSubtypeRoutes.use("*", routeTracer.traceRoute("material-subtype"))
materialSubtypeRoutes.route("/", materialSubtypeController.getRoutes())
mainApp.route("/annual-planning/program-plans", materialSubtypeRoutes)

// Annual Planning Program Plan
const annualPlanningProgramPlanRoutes = new Hono()
annualPlanningProgramPlanRoutes.use(
  "*",
  routeTracer.traceRoute("annual-planning-program-plan")
)
annualPlanningProgramPlanRoutes.route(
  "/program-plans",
  annualPlanningProgramPlanController.getRoutes()
)
mainApp.route("/annual-planning", annualPlanningProgramPlanRoutes)

// Annual Planning Group Target
const annualPlanningGroupTargetRoutes = new Hono()
annualPlanningGroupTargetRoutes.use(
  "*",
  routeTracer.traceRoute("annual-planning-group-target")
)
annualPlanningGroupTargetRoutes.route(
  "/program-plans",
  annualPlanningGroupTargetController.getRoutes()
)
mainApp.route("/annual-planning", annualPlanningGroupTargetRoutes)

const annualNeedRoutes = new Hono()
annualNeedRoutes.use("*", routeTracer.traceRoute("annual-needs"))
annualNeedRoutes.route("/annual-needs", annualNeedsController.getRoutes())
mainApp.route("/annual-planning", annualNeedRoutes)

// Annual Need by Entity route
const annualNeedEntityRoutes = new Hono()
annualNeedEntityRoutes.use(
  "*",
  routeTracer.traceRoute("annual-needs-by-entity")
)
annualNeedEntityRoutes.route("/", annualNeedsController.getEntityRoutes())
mainApp.route("/annual-planning", annualNeedEntityRoutes)

// Annual Need National IP route under program-plans
const annualNeedNationalIpRoutes = new Hono()
annualNeedNationalIpRoutes.use(
  "*",
  routeTracer.traceRoute("annual-needs-national-ip")
)
annualNeedNationalIpRoutes.route("/", annualNeedsController.getRoutes())
mainApp.route("/annual-planning/program-plans", annualNeedNationalIpRoutes)

// Dengue Sentinel Surveillance routes
const dengueSentinelRoutes = new Hono()
dengueSentinelRoutes.use(
  "*",
  featureGuardMiddleware("feature.dengue", { defaultEnabled: false })
)
dengueSentinelRoutes.use("*", routeTracer.traceRoute("sentinel-surveillance"))
dengueSentinelRoutes.route("/", sentinelSurveillanceController.getRoutes())
mainApp.route("/dengue/sentinel-surveillance", dengueSentinelRoutes)

// Dengue Case routes
const dengueCaseRoutes = new Hono()
dengueCaseRoutes.use(
  "*",
  featureGuardMiddleware("feature.dengue", { defaultEnabled: false })
)
dengueCaseRoutes.use("*", routeTracer.traceRoute("case-report"))
dengueCaseRoutes.route("/", dengueCaseController.getRoutes())
mainApp.route("/dengue", dengueCaseRoutes)
/**
 * integration transactions and stock opnames
 */
const integrationRepositoryData = new IntegrationRepository()
const integrationModule = new IntegrationModule(
  integrationRepositoryData,
  stockOpnameRepo
)
const integrationController = new IntegrationController(integrationModule)
const integrationRoutes = new Hono()
integrationRoutes.use("*", routeTracer.traceRoute("ssl"))
integrationRoutes.route("/", integrationController.getRoutes())
mainApp.route("/ssl", integrationRoutes)

// Annual Commitment routes
const annualCommitmentRoutes = new Hono()
annualCommitmentRoutes.use("*", routeTracer.traceRoute("annual-commitments"))
annualCommitmentRoutes.route("/", annualCommitmentController.getRoutes())
mainApp.route("/annual-commitments", annualCommitmentRoutes)

const immunizationRoutes = new Hono()
immunizationRoutes.use(
  "*",
  featureGuardMiddleware("feature.immunization", { defaultEnabled: false })
)
immunizationRoutes.use("*", routeTracer.traceRoute("immunizations"))
immunizationRoutes.route("/", immunizationController.getRoutes())
mainApp.route("/immunization", immunizationRoutes)

const immunizationLogisticsRoutes = new Hono()
immunizationLogisticsRoutes.use(
  "*",
  featureGuardMiddleware("feature.microplanning", { defaultEnabled: false })
)
immunizationLogisticsRoutes.use(
  "*",
  routeTracer.traceRoute("immunization-logistics")
)
immunizationLogisticsRoutes.route(
  "/",
  immunizationLogisticsController.getRoutes()
)
mainApp.route("/immunization-logistics", immunizationLogisticsRoutes)

const biasImmunizationLogisticsRoutes = new Hono()
immunizationLogisticsRoutes.use(
  "*",
  featureGuardMiddleware("feature.microplanning", { defaultEnabled: false })
)
biasImmunizationLogisticsRoutes.use(
  "*",
  routeTracer.traceRoute("bias-immunization-logistics")
)
biasImmunizationLogisticsRoutes.route(
  "/",
  biasImmunizationLogisticsController.getRoutes()
)
mainApp.route("/bias-immunization-logistics", biasImmunizationLogisticsRoutes)

const nonBiasImmunizationLogisticsRoutes = new Hono()
immunizationLogisticsRoutes.use(
  "*",
  featureGuardMiddleware("feature.microplanning", { defaultEnabled: false })
)
nonBiasImmunizationLogisticsRoutes.use(
  "*",
  routeTracer.traceRoute("non-bias-immunization-logistics")
)
nonBiasImmunizationLogisticsRoutes.route(
  "/",
  nonBiasImmunizationLogisticsController.getRoutes()
)
mainApp.route(
  "/non-bias-immunization-logistics",
  nonBiasImmunizationLogisticsRoutes
)

// Emonev routes
const emonevRoutes = new Hono()
emonevRoutes.use("*", routeTracer.traceRoute("integration-emonev"))
emonevRoutes.route("/", emonevController.getRoutes())
mainApp.route("/integration/emonev", emonevRoutes)

export {
  entityConsumer,
  mainApp,
  orderConsumer,
  reconciliationConsumer,
  stockConsumer,
  stockOpnameConsumer,
  tolgeeConsumer,
  transactionConsumer,
}
