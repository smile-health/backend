import { db } from "@/common/infrastructure/database/index.js"
import { getConnection } from "@/common/infrastructure/mq/index.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"
import { AccountController } from "@/modules/account/account.controller.js"
import { AccountModule } from "@/modules/account/account.module.js"
import { AccountRepository } from "@/modules/account/account.repository.js"
import { EntityController } from "@/modules/entity/entity.controller.js"
import { EntityMiddleware } from "@/modules/entity/entity.middleware.js"
import { EntityModule } from "@/modules/entity/entity.module.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { MasterController } from "@/modules/master/master.controller.js"
import { MasterModule } from "@/modules/master/master.module.js"
import { MasterRepository } from "@/modules/master/master.repository.js"
import { UserController } from "@/modules/user/user.controller.js"
import { UsersMiddleware } from "@/modules/user/user.middleware.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { AuthKeycloakService as AuthKcServiceLib } from "@smile-health/lib/api"
import { TransactionManager } from "@smile-health/lib/database.js"
import { featureFlagsMiddleware } from "@smile-health/lib/feature-flags/middleware.js"
import {
  createRefreshHandler,
  createWebhookHandler,
} from "@smile-health/lib/feature-flags/webhook.js"
import { reloadTranslations } from "@smile-health/lib/i18n.js"
import {
  ExcelMiddleware,
  RequestMiddleware,
  TransactionMiddleware,
} from "@smile-health/lib/middlewares"
import { EventMiddleware } from "@smile-health/lib/middlewares/event.middleware.js"
import { Consumer, Publisher, TOPIC } from "@smile-health/lib/rabbitmq"
import { middlewareTracer, routeTracer } from "@smile-health/lib/tracing.js" // Import the enhanced tracing middleware
import { randomUUID } from "crypto"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { StatusCodes } from "http-status-codes"
import { env } from "process"
import {
  AuthKeycloakMiddleware,
  AuthMiddleware,
} from "./common/middlewares/auth.middleware.js"
import { RoleValidationMiddleware } from "./common/middlewares/role-validation.middleware.js"
import { RolesToResourceMappingRepository } from "./common/repository/roles.repository.js"
import { AccountMiddleware } from "./modules/account/account.middleware.js"
import { ActivityController } from "./modules/activity/activity.controller.js"
import { ActivityMiddleware } from "./modules/activity/activity.middleware.js"
import { ActivityModule } from "./modules/activity/activity.module.js"
import { ActivityPublisher } from "./modules/activity/activity.publisher.js"
import { ActivityRepository } from "./modules/activity/activity.repository.js"
import { AnnualPlanningGroupTargetController } from "./modules/annual-planning-group-target/annual-planning-group-target.controller.js"
import { AnnualPlanningGroupTargetMiddleware } from "./modules/annual-planning-group-target/annual-planning-group-target.middleware.js"
import { AnnualPlanningGroupTargetModule } from "./modules/annual-planning-group-target/annual-planning-group-target.module.js"
import { AnnualPlanningGroupTargetRepository } from "./modules/annual-planning-group-target/annual-planning-group-target.repository.js"
import { AsikController } from "./modules/asik/asik.controller.js"
import { AsikModule } from "./modules/asik/asik.module.js"
import { AsikRepository } from "./modules/asik/asik.repository.js"
import { AssetInventoryController } from "./modules/asset-inventory/asset-inventory.controller.js"
import { AssetInventoryMiddleware } from "./modules/asset-inventory/asset-inventory.middleware.js"
import { AssetInventoryModule } from "./modules/asset-inventory/asset-inventory.module.js"
import { AssetInventoryRepository } from "./modules/asset-inventory/asset-inventory.repository.js"
import { AssetModelController } from "./modules/asset-model/asset-model.controller.js"
import { AssetModelMiddleware } from "./modules/asset-model/asset-model.middleware.js"
import { AssetModelModule } from "./modules/asset-model/asset-model.module.js"
import { AssetModelRepository } from "./modules/asset-model/asset-model.repository.js"
import { AssetMonitoringDeviceController } from "./modules/asset-monitoring-device/asset-monitoring-device.controller.js"
import { AssetMonitoringDeviceMiddleware } from "./modules/asset-monitoring-device/asset-monitoring-device.middleware.js"
import { AssetMonitoringDeviceModule } from "./modules/asset-monitoring-device/asset-monitoring-device.module.js"
import { AssetMonitoringDeviceRepository } from "./modules/asset-monitoring-device/asset-monitoring-device.repository.js"
import { AssetMonitoringTemperatureController } from "./modules/asset-monitoring-temperature/asset-monitoring-temperature.controller.js"
import { AssetMonitoringTemperatureMiddleware } from "./modules/asset-monitoring-temperature/asset-monitoring-temperature.middleware.js"
import { AssetMonitoringTemperatureModule } from "./modules/asset-monitoring-temperature/asset-monitoring-temperature.module.js"
import { AssetMonitoringTemperatureRepository } from "./modules/asset-monitoring-temperature/asset-monitoring-temperature.repository.js"
import { AssetMonitoringTemperatureNotification } from "./modules/asset-monitoring-temperature/utils/asset-monitoring-temperature.notification.js"
import { AssetTypeController } from "./modules/asset-type/asset-type.controller.js"
import { AssetTypeMiddleware } from "./modules/asset-type/asset-type.middleware.js"
import { AssetTypeModule } from "./modules/asset-type/asset-type.module.js"
import { AssetTypeRepository } from "./modules/asset-type/asset-type.repository.js"
import { AssetTypesClassificationRepository } from "./modules/asset-types-classification/asset-types-classification.repository.js"
import { AssetTypesTemperatureRepository } from "./modules/asset-types-temperature/asset-types-temperature.repository.js"
import { AssetVendorTypeController } from "./modules/asset-vendor-type/asset-vendor-type.controller.js"
import { AssetVendorTypeModule } from "./modules/asset-vendor-type/asset-vendor-type.module.js"
import { AssetVendorTypeRepository } from "./modules/asset-vendor-type/asset-vendor-type.repository.js"
import { AssetVendorController } from "./modules/asset-vendor/asset-vendor.controller.js"
import { AssetVendorMiddleware } from "./modules/asset-vendor/asset-vendor.middleware.js"
import { AssetVendorModule } from "./modules/asset-vendor/asset-vendor.module.js"
import { AssetVendorRepository } from "./modules/asset-vendor/asset-vendor.repository.js"
import { AssetCalibrationScheduleController } from "./modules/asset-calibration-schedule/asset-calibration-schedule.controller.js"
import { AssetCalibrationScheduleModule } from "./modules/asset-calibration-schedule/asset-calibration-schedule.module.js"
import { AssetCalibrationScheduleRepository } from "./modules/asset-calibration-schedule/asset-calibration-schedule.repository.js"
import { AssetMaintenanceScheduleController } from "./modules/asset-maintenance-schedule/asset-maintenance-schedule.controller.js"
import { AssetMaintenanceScheduleModule } from "./modules/asset-maintenance-schedule/asset-maintenance-schedule.module.js"
import { AssetMaintenanceScheduleRepository } from "./modules/asset-maintenance-schedule/asset-maintenance-schedule.repository.js"
import { AssetWorkingStatusController } from "./modules/asset-working-status/asset-working-status.controller.js"
import { AssetWorkingStatusModule } from "./modules/asset-working-status/asset-working-status.module.js"
import { AssetWorkingStatusRepository } from "./modules/asset-working-status/asset-working-status.repository.js"
import { AssetElectricityController } from "./modules/asset-electricity/asset-electricity.controller.js"
import { AssetElectricityModule } from "./modules/asset-electricity/asset-electricity.module.js"
import { AssetElectricityRepository } from "./modules/asset-electricity/asset-electricity.repository.js"
import { AuthKeycloakService } from "./modules/auth/auth.keycloak.service.js"
import { BudgetSourceController } from "./modules/budget-source/budget-source.controller.js"
import { BudgetSourceMiddleware } from "./modules/budget-source/budget-source.middleware.js"
import { BudgetSourceModule } from "./modules/budget-source/budget-source.module.js"
import { BudgetSourcePublisher } from "./modules/budget-source/budget-source.publisher.js"
import { BudgetSourceRepository } from "./modules/budget-source/budget-source.repository.js"
import { CceigatController } from "./modules/cceigat/cceigat.controller.js"
import { CceigatModule } from "./modules/cceigat/cceigat.module.js"
import { CceigatRepository } from "./modules/cceigat/cceigat.repository.js"
import { ColdstorageController } from "./modules/coldstorage/coldstorage.controller.js"
import { ColdstorageModule } from "./modules/coldstorage/coldstorage.module.js"
import { ColdstorageRepository } from "./modules/coldstorage/coldstorage.repository.js"
import { ColdStorageMiddleware } from "./modules/coldstorage/coldstorage.middleware.js"
import { EducationController } from "./modules/education/education.controller.js"
import { EducationModule } from "./modules/education/education.module.js"
import { EducationRepository } from "./modules/education/education.repository.js"
import { EntityTagController } from "./modules/entity-tag/entity-tag.controller.js"
import { EntityTagMiddleware } from "./modules/entity-tag/entity-tag.middleware.js"
import { EntityTagModule } from "./modules/entity-tag/entity-tag.module.js"
import { EntityTagRepository } from "./modules/entity-tag/entity-tag.repository.js"
import { EntityTypeController } from "./modules/entity-type/entity-type.controller.js"
import { EntityTypeMiddleware } from "./modules/entity-type/entity-type.middleware.js"
import { EntityTypeModule } from "./modules/entity-type/entity-type.module.js"
import { EntityTypeRepository } from "./modules/entity-type/entity-type.repository.js"
import { EntityPublisher } from "./modules/entity/entity.publisher.js"
import { EntityWorker } from "./modules/entity/entity.worker.js"
import { EthnicController } from "./modules/ethnic/ethnic.controller.js"
import { EthnicModule } from "./modules/ethnic/ethnic.module.js"
import { EthnicRepository } from "./modules/ethnic/ethnic.repository.js"
import { ExportHistoryController } from "./modules/export-history/export-history.controller.js"
import { ExportHistoryModule } from "./modules/export-history/export-history.module.js"
import { ExportHistoryRepository } from "./modules/export-history/export-history.repository.js"
import { GenderController } from "./modules/gender/gender.controller.js"
import { GenderModule } from "./modules/gender/gender.module.js"
import { GenderRepository } from "./modules/gender/gender.repository.js"
import { IntegrationRepository } from "./modules/integration/integration.repository.js"
import { LocationRepository } from "./modules/location/location.repository.js"
import { ManufactureController } from "./modules/manufacture/manufacture.controller.js"
import { ManufactureMiddleware } from "./modules/manufacture/manufacture.middleware.js"
import { ManufactureModule } from "./modules/manufacture/manufacture.module.js"
import { ManufacturePublisher } from "./modules/manufacture/manufacture.publisher.js"
import { ManufactureRepository } from "./modules/manufacture/manufacture.repository.js"
import { MaritalStatusController } from "./modules/marital-status/marital-status.controller.js"
import { MaritalStatusModule } from "./modules/marital-status/marital-status.module.js"
import { MaritalStatusRepository } from "./modules/marital-status/marital-status.repository.js"
import { MaterialLevelController } from "./modules/material-level/material-level.controller.js"
import { MaterialLevelModule } from "./modules/material-level/material-level.module.js"
import { MaterialLevelRepository } from "./modules/material-level/material-level.repository.js"
import { MaterialRelationController } from "./modules/material-relation/material-relation.controller.js"
import { MaterialRelationModule } from "./modules/material-relation/material-relation.module.js"
import { MaterialRelationRepository } from "./modules/material-relation/material-relation.repository.js"
import { MaterialTypeController } from "./modules/material-type/material-type.controller.js"
import { MaterialTypeModule } from "./modules/material-type/material-type.module.js"
import { MaterialTypeRepository } from "./modules/material-type/material-type.repository.js"
import { MaterialUnitController } from "./modules/material-unit/material-unit.controller.js"
import { MaterialUnitModule } from "./modules/material-unit/material-unit.module.js"
import { MaterialUnitRepository } from "./modules/material-unit/material-unit.repository.js"
import { MaterialVolumesController } from "./modules/material-volumes/material-volumes.controller.js"
import { MaterialVolumesMiddleware } from "./modules/material-volumes/material-volumes.middleware.js"
import { MaterialVolumesModule } from "./modules/material-volumes/material-volumes.module.js"
import { MaterialVolumesRepository } from "./modules/material-volumes/material-volumes.repository.js"
import { MaterialController } from "./modules/material/material.controller.js"
import { MaterialMiddleware } from "./modules/material/material.middleware.js"
import { MaterialModule } from "./modules/material/material.module.js"
import { MaterialPublisher } from "./modules/material/material.publisher.js"
import { MaterialRepository } from "./modules/material/material.repository.js"
import { NotificationController } from "./modules/notification/notification.controller.js"
import { NotificationMiddleware } from "./modules/notification/notification.middleware.js"
import { NotificationModule } from "./modules/notification/notification.module.js"
import { NotificationRepository } from "./modules/notification/notification.repository.js"
import { OccupationController } from "./modules/occupation/occupation.controller.js"
import { OccupationModule } from "./modules/occupation/occupation.module.js"
import { OccupationRepository } from "./modules/occupation/occupation.repository.js"
import { PatientExcelController } from "./modules/patient/patient.excel.controller.js"
import { PatientExcelMiddleware } from "./modules/patient/patient.excel.middleware.js"
import { PatientExcelModule } from "./modules/patient/patient.excel.module.js"
import { PatientExcelRepository } from "./modules/patient/patient.excel.repository.js"
import { PopulationController } from "./modules/population/population.controller.js"
import { PopulationExcelController } from "./modules/population/population.excel.controller.js"
import { PopulationExcelMiddleware } from "./modules/population/population.excel.middleware.js"
import { PopulationExcelModule } from "./modules/population/population.excel.module.js"
import { PopulationExcelRepository } from "./modules/population/population.excel.repository.js"
import { PopulationModule } from "./modules/population/population.module.js"
import { PopulationRepository } from "./modules/population/population.repository.js"
import { ProgramController } from "./modules/program/program.controller.js"
import { ProgramMiddleware } from "./modules/program/program.middleware.js"
import { ProgramModule } from "./modules/program/program.module.js"
import { ProgramPublisher } from "./modules/program/program.publisher.js"
import { ProgramRepository } from "./modules/program/program.repository.js"
import { ProtocolController } from "./modules/protocol/protocol.controller.js"
import { ProtocolModule } from "./modules/protocol/protocol.module.js"
import { ProtocolRepository } from "./modules/protocol/protocol.repository.js"
import { ReactionController } from "./modules/reaction/reaction.controller.js"
import { ReactionModule } from "./modules/reaction/reaction.module.js"
import { ReactionRepository } from "./modules/reaction/reaction.repository.js"
import { ReligionController } from "./modules/religion/religion.controller.js"
import { ReligionModule } from "./modules/religion/religion.module.js"
import { ReligionRepository } from "./modules/religion/religion.repository.js"
import { RoleRepository } from "./modules/role/role.repository.js"
import { TemperatureThresholdController } from "./modules/temperature-threshold/temperature-threshold.controller.js"
import { TemperatureThresholdModule } from "./modules/temperature-threshold/temperature-threshold.module.js"
import { TemperatureThresholdRepository } from "./modules/temperature-threshold/temperature-threshold.repository.js"
import { TypePQsController } from "./modules/type-pqs/type-pqs.controller.js"
import { TypePQsModule } from "./modules/type-pqs/type-pqs.module.js"
import { TypePQsepository } from "./modules/type-pqs/type-pqs.repository.js"
import { userExternalController } from "./modules/user/external/index.js"
import { UserModule } from "./modules/user/user.module.js"
import { UserPublisher } from "./modules/user/user.publisher.js"
import { WhoPqsController } from "./modules/who-pqs/who-pqs.controller.js"
import { WhoPqsMiddleware } from "./modules/who-pqs/who-pqs.middleware.js"
import { WhoPqsModule } from "./modules/who-pqs/who-pqs.module.js"
import { WhoPqsRepository } from "./modules/who-pqs/who-pqs.repository.js"
import { WorkspaceController } from "./modules/workspace/workspace.controller.js"
import { WorkspaceModule } from "./modules/workspace/workspace.module.js"
import { WorkspaceRepository } from "./modules/workspace/workspace.repository.js"
import { MaterialSubtypeController } from "./modules/material-subtype/material-subtype.controller.js"
import { MaterialSubtypeModule } from "./modules/material-subtype/material-subtype.module.js"
import { MaterialSubtypeRepository } from "./modules/material-subtype/material-subtype.repository.js"
import { ColdstorageWorker } from "./modules/coldstorage/coldstorage.worker.js"
import { ColdstorageNotification } from "./modules/coldstorage/utils/coldstorage.notification.js"

// inject dependencies
const mq = getConnection
const trxManager = new TransactionManager(db)
const publisher = new Publisher(mq)
const accountConsumer = new Consumer(mq, trxManager, "account-queue")

const accountRepo = new AccountRepository()
const entityRepo = new EntityRepository()
const entityTagRepo = new EntityTagRepository()
const entityTypeRepo = new EntityTypeRepository()
const locationRepo = new LocationRepository()
const roleRepo = new RoleRepository()
const userRepo = new UserRepository()
const workspaceRepo = new WorkspaceRepository()
const budgetSourceRepo = new BudgetSourceRepository()
const manufactureRepo = new ManufactureRepository()
const materialRepo = new MaterialRepository()
const materialRelationRepo = new MaterialRelationRepository()
const materialLevelRepo = new MaterialLevelRepository()
const materialTypeRepo = new MaterialTypeRepository()
const materialUnitRepo = new MaterialUnitRepository()
const masterRepo = new MasterRepository()
const rolesToResourceMappingRepo = new RolesToResourceMappingRepository()
const programRepo = new ProgramRepository()
const activityRepo = new ActivityRepository()
const notificationRepo = new NotificationRepository()
const assetVendorTypeRepo = new AssetVendorTypeRepository()
const assetVendorRepo = new AssetVendorRepository()
const assetTypeRepo = new AssetTypeRepository()
const assetModelRepo = new AssetModelRepository()
const assetWorkingStatusRepo = new AssetWorkingStatusRepository()
const assetCalibrationScheduleRepo = new AssetCalibrationScheduleRepository()
const assetMaintenanceScheduleRepo = new AssetMaintenanceScheduleRepository()
const assetElectricityRepo = new AssetElectricityRepository()
const assetInventoryRepo = new AssetInventoryRepository()
const exportHistoryRepo = new ExportHistoryRepository()
const integrationRepo = new IntegrationRepository()
const materialVolumesRepo = new MaterialVolumesRepository()
const typePQsRepo = new TypePQsepository()
const cceigatRepo = new CceigatRepository()
const coldstorageRepo = new ColdstorageRepository()
const whoPqsRepo = new WhoPqsRepository()
const temperatureThresholdRepo = new TemperatureThresholdRepository()
const assetTypesTemperatureRepo = new AssetTypesTemperatureRepository()
const educationRepo = new EducationRepository()
const ethnicRepo = new EthnicRepository()
const occupationRepo = new OccupationRepository()
const religionRepo = new ReligionRepository()
const reactionRepo = new ReactionRepository()
const maritalStatusRepo = new MaritalStatusRepository()
const genderRepo = new GenderRepository()
const assetTypesClassificationRepo = new AssetTypesClassificationRepository()
const annualPlanningGrooupTargetRepo = new AnnualPlanningGroupTargetRepository()
const populationRepo = new PopulationRepository()
const materialSubtypeRepo = new MaterialSubtypeRepository()
const asikRepo = new AsikRepository()

const userPublisher = new UserPublisher(publisher, userRepo)
const budgetSourcePublisher = new BudgetSourcePublisher(
  publisher,
  budgetSourceRepo
)

const accountMiddleware = new AccountMiddleware(accountRepo)
const accountModule = new AccountModule(
  userRepo,
  entityRepo,
  workspaceRepo,
  locationRepo,
  new AuthKeycloakService(env.AUTH_URL ?? "http://localhost:5001"),
  manufactureRepo,
  userPublisher
)
const accountController = new AccountController(
  accountMiddleware,
  accountModule
)

const excelMiddleware = new ExcelMiddleware()
const roleValidationMiddleware = new RoleValidationMiddleware()

// Asset Monitoring Device Module
const assetMonitoringDeviceRepo = new AssetMonitoringDeviceRepository()
const assetMonitoringDeviceModule = new AssetMonitoringDeviceModule(
  assetMonitoringDeviceRepo
)
const assetMonitoringDeviceMiddleware = new AssetMonitoringDeviceMiddleware(
  assetMonitoringDeviceRepo
)
const assetMonitoringDeviceController = new AssetMonitoringDeviceController(
  assetMonitoringDeviceModule,
  assetMonitoringDeviceMiddleware,
  excelMiddleware
)

// Asset Monitoring Temperature Module
const assetMonitoringTemperatureRepo =
  new AssetMonitoringTemperatureRepository()
const notificationTypeRepo = new NotificationTypeRepository()
const assetMonitoringTemperatureNotification =
  new AssetMonitoringTemperatureNotification(
    assetMonitoringTemperatureRepo,
    userRepo,
    publisher,
    notificationTypeRepo
  )
const assetMonitoringTemperatureModule = new AssetMonitoringTemperatureModule(
  assetMonitoringTemperatureRepo,
  assetMonitoringTemperatureNotification
)
const assetMonitoringTemperatureMiddleware =
  new AssetMonitoringTemperatureMiddleware(assetMonitoringTemperatureRepo)
const assetMonitoringTemperatureController =
  new AssetMonitoringTemperatureController(
    assetMonitoringTemperatureModule,
    assetMonitoringTemperatureMiddleware,
    excelMiddleware
  )

const entityPublisher = new EntityPublisher(publisher, entityRepo)
const entityModule = new EntityModule(
  entityRepo,
  workspaceRepo,
  locationRepo,
  entityTypeRepo,
  entityTagRepo,
  integrationRepo,
  exportHistoryRepo,
  entityPublisher
)
const entityConsumer = new Consumer(mq, trxManager)
const entityWorker = new EntityWorker(entityRepo, exportHistoryRepo)
entityWorker.registerWorkers(entityConsumer)
const entityMiddleware = new EntityMiddleware(
  entityRepo,
  entityTagRepo,
  workspaceRepo,
  entityTypeRepo,
  locationRepo
)
const entityController = new EntityController(
  entityModule,
  entityMiddleware,
  excelMiddleware,
  roleValidationMiddleware
)

const entityTagModule = new EntityTagModule(entityTagRepo)
const entityTagMiddleware = new EntityTagMiddleware()
const entityTagController = new EntityTagController(
  entityTagModule,
  entityTagMiddleware,
  roleValidationMiddleware
)

const entityTypeModule = new EntityTypeModule(entityTypeRepo)
const entityTypeMiddleware = new EntityTypeMiddleware()
const entityTypeController = new EntityTypeController(
  entityTypeModule,
  entityTypeMiddleware,
  roleValidationMiddleware
)

const usersModule = new UserModule(
  userRepo,
  entityRepo,
  workspaceRepo,
  locationRepo,
  roleRepo,
  manufactureRepo,
  integrationRepo,
  new AuthKeycloakService(env.AUTH_URL ?? "http://localhost:5001"),
  userPublisher
)

const masterModule = new MasterModule(masterRepo, roleRepo)
const masterController = new MasterController(masterModule)

const usersMiddleware = new UsersMiddleware(userRepo, roleRepo, workspaceRepo)
const usersController = new UserController(
  usersModule,
  usersMiddleware,
  roleValidationMiddleware,
  excelMiddleware
)

const authMiddleware = new AuthMiddleware(accountRepo)
const authMiddlewareKc = new AuthKeycloakMiddleware(
  new AuthKcServiceLib(env.AUTH_URL ?? "http://localhost:5001"),
  userRepo,
  integrationRepo
)
const requestMiddleware = new RequestMiddleware()
const evtMiddleware = new EventMiddleware(publisher)
const trxMiddleware = new TransactionMiddleware(trxManager)

const workspaceModule = new WorkspaceModule(workspaceRepo)
const workspaceController = new WorkspaceController(
  workspaceModule,
  roleValidationMiddleware
)

const budgetSourceMiddleware = new BudgetSourceMiddleware(
  budgetSourceRepo,
  workspaceRepo
)
const budgetSourceModule = new BudgetSourceModule(
  budgetSourceRepo,
  workspaceRepo,
  userRepo,
  budgetSourcePublisher
)
const budgetSourceController = new BudgetSourceController(
  budgetSourceModule,
  budgetSourceMiddleware,
  roleValidationMiddleware,
  excelMiddleware
)

const manufacturePublisher = new ManufacturePublisher(
  publisher,
  manufactureRepo
)
const programPublisher = new ProgramPublisher(publisher, programRepo)
const manufactureModule = new ManufactureModule(
  manufactureRepo,
  workspaceRepo,
  userRepo,
  manufacturePublisher
)
const manufactureMiddleware = new ManufactureMiddleware(
  manufactureRepo,
  workspaceRepo
)
const manufactureController = new ManufactureController(
  manufactureModule,
  manufactureMiddleware,
  excelMiddleware
)

const materialMiddleware = new MaterialMiddleware(
  materialRepo,
  materialLevelRepo,
  materialTypeRepo,
  materialUnitRepo,
  workspaceRepo,
  materialSubtypeRepo
)
const materialPublisher = new MaterialPublisher(publisher, materialRepo)
const materialModule = new MaterialModule(
  materialRepo,
  materialLevelRepo,
  materialTypeRepo,
  materialUnitRepo,
  materialRelationRepo,
  workspaceRepo,
  userRepo,
  materialPublisher,
  integrationRepo,
  materialSubtypeRepo
)
const materialController = new MaterialController(
  materialModule,
  materialMiddleware,
  excelMiddleware,
  roleValidationMiddleware
)

const materialRelationModule = new MaterialRelationModule(materialRelationRepo)
const materialRelationController = new MaterialRelationController(
  materialRelationModule,
  roleValidationMiddleware
)

const materialLevelModule = new MaterialLevelModule(materialLevelRepo)
const materialLevelController = new MaterialLevelController(
  materialLevelModule,
  roleValidationMiddleware
)

const materialTypeModule = new MaterialTypeModule(materialTypeRepo)
const materialTypeController = new MaterialTypeController(
  materialTypeModule,
  roleValidationMiddleware
)

const materialUnitModule = new MaterialUnitModule(materialUnitRepo)
const materialUnitController = new MaterialUnitController(
  materialUnitModule,
  roleValidationMiddleware
)

const programModule = new ProgramModule(
  programRepo,
  activityRepo,
  programPublisher
)
const programMiddleware = new ProgramMiddleware(programRepo)
const programController = new ProgramController(
  programModule,
  programMiddleware,
  excelMiddleware
)

const activityPublisher = new ActivityPublisher(publisher)
const activityModule = new ActivityModule(
  activityRepo,
  userRepo,
  activityPublisher
)
const activityMiddleware = new ActivityMiddleware(activityRepo, programRepo)
const activityController = new ActivityController(
  activityModule,
  activityMiddleware,
  excelMiddleware
)

const notificationMiddleware = new NotificationMiddleware(notificationRepo)
const notificationModule = new NotificationModule(notificationRepo)
const notificationController = new NotificationController(
  notificationModule,
  notificationMiddleware
)

const assetVendorTypeModule = new AssetVendorTypeModule(assetVendorTypeRepo)
const assetVendorTypeController = new AssetVendorTypeController(
  assetVendorTypeModule
)

const assetVendorMiddleware = new AssetVendorMiddleware(assetVendorRepo)
const assetVendorModule = new AssetVendorModule(assetVendorRepo)
const assetVendorController = new AssetVendorController(
  assetVendorModule,
  assetVendorMiddleware,
  excelMiddleware
)

const assetTypeMiddleware = new AssetTypeMiddleware(
  assetTypeRepo,
  temperatureThresholdRepo,
  assetTypesClassificationRepo,
  assetModelRepo,
  assetTypesTemperatureRepo
)
const assetTypeModule = new AssetTypeModule(
  assetTypeRepo,
  assetTypesTemperatureRepo,
  userRepo,
  assetTypesClassificationRepo,
  integrationRepo,
  assetModelRepo
)
const assetTypeController = new AssetTypeController(
  assetTypeModule,
  assetTypeMiddleware,
  excelMiddleware
)

const assetModelMiddleware = new AssetModelMiddleware(
  assetModelRepo,
  whoPqsRepo,
  temperatureThresholdRepo,
  assetTypesTemperatureRepo,
  assetInventoryRepo
)
const assetModelModule = new AssetModelModule(
  assetModelRepo,
  assetTypesTemperatureRepo,
  userRepo,
  temperatureThresholdRepo,
  assetInventoryRepo
)
const assetModelController = new AssetModelController(
  assetModelModule,
  assetModelMiddleware,
  excelMiddleware
)

// Asset Working Status
const assetWorkingStatusModule = new AssetWorkingStatusModule(
  assetWorkingStatusRepo
)
const assetWorkingStatusController = new AssetWorkingStatusController(
  assetWorkingStatusModule
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
// Asset Electricity
const assetElectricityModule = new AssetElectricityModule(assetElectricityRepo)
const assetElectricityController = new AssetElectricityController(
  assetElectricityModule
)

// Asset Inventory
const assetInventoryMiddleware = new AssetInventoryMiddleware(
  assetInventoryRepo
)
const assetInventoryModule = new AssetInventoryModule(
  assetInventoryRepo,
  integrationRepo,
  workspaceRepo
)
const assetInventoryController = new AssetInventoryController(
  assetInventoryModule,
  assetInventoryMiddleware,
  excelMiddleware
)

const exportHistoryModule = new ExportHistoryModule(
  exportHistoryRepo,
  userRepo,
  workspaceRepo
)
const exportHistoryController = new ExportHistoryController(exportHistoryModule)

const materialVolumesMiddleware = new MaterialVolumesMiddleware(
  materialRepo,
  manufactureRepo,
  materialVolumesRepo
)
const materialVolumesModule = new MaterialVolumesModule(
  materialVolumesRepo,
  materialRepo,
  manufactureRepo,
  userRepo
)
const materialVolumesController = new MaterialVolumesController(
  materialVolumesModule,
  materialVolumesMiddleware,
  excelMiddleware
)

const typePQsModule = new TypePQsModule(typePQsRepo)
const typePQsController = new TypePQsController(typePQsModule)

const cceigatModule = new CceigatModule(cceigatRepo)
const cceigatController = new CceigatController(cceigatModule)

const whoPqsMiddleware = new WhoPqsMiddleware(
  whoPqsRepo,
  typePQsRepo,
  cceigatRepo,
  assetModelRepo
)
const whoPqsModule = new WhoPqsModule(whoPqsRepo, userRepo, assetModelRepo)
const whoPqsController = new WhoPqsController(
  whoPqsModule,
  excelMiddleware,
  whoPqsMiddleware
)

const temperatureThresholdModule = new TemperatureThresholdModule(
  temperatureThresholdRepo
)
const temperatureThresholdController = new TemperatureThresholdController(
  temperatureThresholdModule
)

const educationModule = new EducationModule(educationRepo)
const educationController = new EducationController(educationModule)

const ethnicModule = new EthnicModule(ethnicRepo)
const ethnicController = new EthnicController(ethnicModule)

const occupationModule = new OccupationModule(occupationRepo)
const occupationController = new OccupationController(occupationModule)

const religionModule = new ReligionModule(religionRepo)
const religionController = new ReligionController(religionModule)

const reactionModule = new ReactionModule(reactionRepo)
const reactionController = new ReactionController(reactionModule)

const maritalStatusModule = new MaritalStatusModule(maritalStatusRepo)
const maritalStatusController = new MaritalStatusController(maritalStatusModule)

const genderModule = new GenderModule(genderRepo)
const genderController = new GenderController(genderModule)

const protocolRepo = new ProtocolRepository()
const protocolModule = new ProtocolModule(protocolRepo)
const protocolController = new ProtocolController(protocolModule)

// Annual Planning
const annualPlanningGroupTargetModule = new AnnualPlanningGroupTargetModule(
  annualPlanningGrooupTargetRepo
)
const annualPlanningGrooupTargetMiddleware =
  new AnnualPlanningGroupTargetMiddleware(annualPlanningGrooupTargetRepo)
const annualPlanningGroupTargetController =
  new AnnualPlanningGroupTargetController(
    annualPlanningGroupTargetModule,
    annualPlanningGrooupTargetMiddleware,
    excelMiddleware
  )

// Material Subtype
const materialSubtypeModule = new MaterialSubtypeModule(materialSubtypeRepo)
const materialSubtypeController = new MaterialSubtypeController(
  materialSubtypeModule
)

// Population
const populationModule = new PopulationModule(populationRepo, userRepo)
const populationController = new PopulationController(populationModule)

// Population Excel
const populationExcelRepo = new PopulationExcelRepository()
const populationExcelModule = new PopulationExcelModule(
  entityRepo,
  annualPlanningGrooupTargetRepo,
  populationExcelRepo,
  userRepo,
  locationRepo
)
const populationExcelMiddleware = new PopulationExcelMiddleware(
  entityRepo,
  annualPlanningGrooupTargetRepo
)
const populationExcelController = new PopulationExcelController(
  populationExcelModule,
  excelMiddleware,
  populationExcelMiddleware
)

// Patient Excel
const patientExcelRepo = new PatientExcelRepository()
const patientExcelModule = new PatientExcelModule(
  patientExcelRepo,
  userRepo,
  locationRepo,
  educationRepo,
  occupationRepo,
  religionRepo,
  ethnicRepo
)
const patientExcelMiddleware = new PatientExcelMiddleware(
  patientExcelRepo,
  locationRepo
)
const patientExcelController = new PatientExcelController(
  patientExcelModule,
  excelMiddleware,
  patientExcelMiddleware
)

// Coldstorage
const coldstorageConsumer = new Consumer(mq, trxManager)
const coldstorageModule = new ColdstorageModule(
  coldstorageRepo,
  entityRepo,
  new ColdstorageNotification(
    coldstorageRepo,
    userRepo,
    publisher,
    notificationTypeRepo
  )
)
const coldstorageMiddleware = new ColdStorageMiddleware()
const coldstorageController = new ColdstorageController(
  coldstorageModule,
  coldstorageMiddleware,
  excelMiddleware
)
const coldstorageWorker = new ColdstorageWorker(coldstorageModule)
coldstorageWorker.registerWorkers(coldstorageConsumer)

const asikModule = new AsikModule(asikRepo)
const asikController = new AsikController(asikModule)

// Main App routes with enhanced tracing
const mainApp = new Hono()
mainApp.use(cors())

// Apply enhanced middleware tracing for performance monitoring
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
  middlewareTracer.traceMiddleware("authMiddlewareKc"),
  authMiddlewareKc.handleAuthKeycloak
)
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("roleValidationMiddleware"),
  roleValidationMiddleware.handle(rolesToResourceMappingRepo)
)
mainApp.use(
  "*",
  middlewareTracer.traceMiddleware("authMiddleware"),
  authMiddleware.handleAuthHeaderReinjection
)
// Route registration with performance tracing
const routeConfigs = [
  { path: "/account", controller: accountController, name: "account" },
  {
    path: "/asset-models",
    controller: assetModelController,
    name: "asset-models",
  },
  {
    path: "/asset-types",
    controller: assetTypeController,
    name: "asset-types",
  },
  {
    path: "/asset-vendors",
    controller: assetVendorController,
    name: "asset-vendors",
  },
  {
    path: "/asset-vendor-types",
    controller: assetVendorTypeController,
    name: "asset-vendor-types",
  },
  {
    path: "/asset-working-statuses",
    controller: assetWorkingStatusController,
    name: "asset-working-statuses",
  },
  {
    path: "/asset-calibration-schedules",
    controller: assetCalibrationScheduleController,
    name: "asset-calibration-schedules",
  },
  {
    path: "/asset-maintenance-schedules",
    controller: assetMaintenanceScheduleController,
    name: "asset-maintenance-schedules",
  },
  {
    path: "/asset-electricities",
    controller: assetElectricityController,
    name: "asset-electricities",
  },
  { path: "/entities", controller: entityController, name: "entities" },
  {
    path: "/entity-tags",
    controller: entityTagController,
    name: "entity-tags",
  },
  {
    path: "/entity-types",
    controller: entityTypeController,
    name: "entity-types",
  },
  {
    path: "/users/ext",
    controller: userExternalController,
    name: "users-external",
  },
  { path: "/users", controller: usersController, name: "users" },
  { path: "/master", controller: masterController, name: "master" },
  { path: "/workspaces", controller: workspaceController, name: "workspaces" },
  { path: "/patients", controller: patientExcelController, name: "patients" },
  {
    path: "/budget-sources",
    controller: budgetSourceController,
    name: "budget-sources",
  },
  {
    path: "/manufactures",
    controller: manufactureController,
    name: "manufactures",
  },
  { path: "/materials", controller: materialController, name: "materials" },
  {
    path: "/material-relations",
    controller: materialRelationController,
    name: "material-relations",
  },
  {
    path: "/material-levels",
    controller: materialLevelController,
    name: "material-levels",
  },
  {
    path: "/material-types",
    controller: materialTypeController,
    name: "material-types",
  },
  {
    path: "/material-units",
    controller: materialUnitController,
    name: "material-units",
  },
  {
    path: "/notifications",
    controller: notificationController,
    name: "notifications",
  },
  {
    path: "/export-histories",
    controller: exportHistoryController,
    name: "export-histories",
  },
  { path: "/programs", controller: programController, name: "programs" },
  {
    path: "/material-volumes",
    controller: materialVolumesController,
    name: "material-volumes",
  },
  {
    path: "/type-pqs",
    controller: typePQsController,
    name: "type-pqs",
  },
  {
    path: "/ccigat",
    controller: cceigatController,
    name: "ccigat",
  },
  {
    path: "/who-pqs",
    controller: whoPqsController,
    name: "who-pqs",
  },
  {
    path: "/temperature-thresholds",
    controller: temperatureThresholdController,
    name: "temperature-thresholds",
  },
  { path: "/educations", controller: educationController, name: "educations" },
  { path: "/ethnics", controller: ethnicController, name: "ethnics" },
  {
    path: "/occupations",
    controller: occupationController,
    name: "occupations",
  },
  { path: "/religions", controller: religionController, name: "religions" },
  { path: "/reactions", controller: reactionController, name: "reactions" },
  {
    path: "/marital-status",
    controller: maritalStatusController,
    name: "marital-status",
  },
  { path: "/genders", controller: genderController, name: "genders" },
  {
    path: "/asset-monitoring-devices",
    controller: assetMonitoringDeviceController,
    name: "asset-monitoring-devices",
  },
  {
    path: "/asset-monitoring-temperature",
    controller: assetMonitoringTemperatureController,
    name: "asset-monitoring-temperature",
  },
  {
    path: "/asset-inventories",
    controller: assetInventoryController,
    name: "asset-inventories",
  },
  { path: "/protocols", controller: protocolController, name: "protocols" },
  {
    path: "/annual-planning",
    controller: annualPlanningGroupTargetController,
    name: "annual-planning",
  },
  {
    path: "/annual-planning",
    controller: populationController,
    name: "population",
  },
  {
    path: "/annual-planning",
    controller: populationExcelController,
    name: "population-excel",
  },
  {
    path: "/annual-planning",
    controller: materialSubtypeController,
    name: "annual-planning",
  },
  {
    path: "/coldstorage",
    controller: coldstorageController,
    name: "coldstorage",
  },
  { path: "/asik", controller: asikController, name: "asik" },
]

// Register routes with individual route tracing
routeConfigs.forEach(({ path, controller, name, middleware }) => {
  const tracedRoutes = new Hono()
  tracedRoutes.use("*", routeTracer.traceRoute(name))

  if (middleware && middleware.length > 0) {
    middleware.forEach((mw) => {
      tracedRoutes.use("*", mw.handleExport)
    })
  }

  tracedRoutes.route("/", controller.getRoutes())
  mainApp.route(path, tracedRoutes)
})

// Special route for activities with nested path tracing
const activitiesRoutes = new Hono()
activitiesRoutes.use("*", routeTracer.traceRoute("program-activities"))
activitiesRoutes.route("/", activityController.getRoutes())
mainApp.route("/programs/:program_id/activities", activitiesRoutes)

// Feature flags webhook routes (public - bypasses auth for external webhooks)
const featureFlagsWebhookRoutes = new Hono()
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
mainApp.route("/feature-flags", featureFlagsWebhookRoutes)

// tolgee
const tolgeeConsumer = new Consumer(getConnection, trxManager, randomUUID())
tolgeeConsumer.route(TOPIC.TOLGEE_RELOADED, async () => {
  await reloadTranslations()
})
mainApp.post("/tolgee/reload", async (c) => {
  await publisher.publish(TOPIC.TOLGEE_RELOADED, {})
  return c.body(null, StatusCodes.NO_CONTENT)
})

export {
  accountConsumer,
  assetMonitoringDeviceController,
  assetMonitoringDeviceModule,
  assetMonitoringTemperatureModule,
  authMiddlewareKc,
  coldstorageConsumer,
  entityConsumer,
  mainApp,
  requestMiddleware,
  tolgeeConsumer,
  trxMiddleware,
}
