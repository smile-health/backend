import { getConnection } from "@/common/infrastructure/mq"
import {
  assetMonitoringTemperatureModule,
  authMiddlewareKc,
  requestMiddleware,
  trxMiddleware,
} from "@/wire"
import { AuthKeycloakService } from "@smile-health/lib/api"
import { Publisher } from "@smile-health/lib/rabbitmq"
import { env } from "process"
import { AssetInventoryRepository } from "../asset-inventory/asset-inventory.repository"
import { AssetModelModule } from "../asset-model/asset-model.module"
import { AssetModelRepository } from "../asset-model/asset-model.repository"
import { AssetTypeModule } from "../asset-type/asset-type.module"
import { AssetTypeRepository } from "../asset-type/asset-type.repository"
import { AssetTypesClassificationRepository } from "../asset-types-classification/asset-types-classification.repository"
import { AssetTypesTemperatureRepository } from "../asset-types-temperature/asset-types-temperature.repository"
import { EntityTagModule } from "../entity-tag/entity-tag.module"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository"
import { EntityTypeRepository } from "../entity-type/entity-type.repository"
import { EntityModule } from "../entity/entity.module"
import { EntityPublisher } from "../entity/entity.publisher"
import { EntityRepository } from "../entity/entity.repository"
import { ExportHistoryRepository } from "../export-history"
import { LocationRepository } from "../location/location.repository"
import { MasterModule } from "../master/master.module"
import { MasterRepository } from "../master/master.repository"
import { RoleRepository } from "../role/role.repository"
import { TemperatureThresholdRepository } from "../temperature-threshold/temperature-threshold.repository"
import { UserRepository } from "../user/user.repository"
import { WorkspaceRepository } from "../workspace/workspace.repository"
import { CommonController } from "./common/common.controller"
import { CommonModule } from "./common/common.module"
import { IntegrationRepository } from "./integration.repository"
import { IotController } from "./iot/iot.controller"
import { AssetMonitoringDeviceModule } from "../asset-monitoring-device/asset-monitoring-device.module"
import { AssetMonitoringDeviceRepository } from "../asset-monitoring-device/asset-monitoring-device.repository"
import { CommonRepository } from "./common/common.repository"
import { IotModule } from "./iot/iot.module"

const publisher = new Publisher(getConnection)
const authRepo = new AuthKeycloakService(
  env.AUTH_URL ?? "http://localhost:5001"
)
const entityRepo = new EntityRepository()
const entityTagRepo = new EntityTagRepository()
const entityTypeRepo = new EntityTypeRepository()
const locationRepo = new LocationRepository()
const roleRepo = new RoleRepository()
const userRepo = new UserRepository()
const workspaceRepo = new WorkspaceRepository()
const masterRepo = new MasterRepository()
const assetTypeRepo = new AssetTypeRepository()
const assetModelRepo = new AssetModelRepository()
const exportHistoryRepo = new ExportHistoryRepository()
const integrationRepo = new IntegrationRepository()
const temperatureThresholdRepo = new TemperatureThresholdRepository()
const assetInventoryRepo = new AssetInventoryRepository()
const assetTypesTemperatureRepo = new AssetTypesTemperatureRepository()
const assetTypesClassificationRepo = new AssetTypesClassificationRepository()

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

const commonApp = new CommonController(
  new CommonModule(
    new IntegrationRepository(),
    authRepo,
    entityModule,
    new EntityTagModule(entityTagRepo),
    new MasterModule(masterRepo, roleRepo),
    new CommonRepository()  
  ),
  requestMiddleware,
  trxMiddleware,
  authMiddlewareKc
)
const iotModule = new IotModule(
  new AssetMonitoringDeviceModule(
    new AssetMonitoringDeviceRepository(),
  ),
  assetMonitoringTemperatureModule,
  new AssetTypeModule(
    assetTypeRepo,
    assetTypesTemperatureRepo,
    userRepo,
    assetTypesClassificationRepo,
    integrationRepo,
    assetModelRepo
  ),
  new AssetModelModule(
    assetModelRepo,
    assetTypesTemperatureRepo,
    userRepo,
    temperatureThresholdRepo,
    assetInventoryRepo
  )
)
const iotApp = new IotController(
  iotModule,
  assetMonitoringTemperatureModule,
  requestMiddleware,
  trxMiddleware,
  authMiddlewareKc
)

export { commonApp, iotApp }
