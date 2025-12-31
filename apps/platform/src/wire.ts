import { db } from "@/common/infrastructure/database/index.js"
import { FallbackController } from "@/modules/fallback/fallback.controller.js"
import { FallbackModule } from "@/modules/fallback/fallback.module.js"
import { UserController } from "@/modules/user/user.controller.js"
import { UserModule } from "@/modules/user/user.module.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { TransactionManager } from "@smile/lib/database.js"
import {
  ExcelMiddleware,
  RequestMiddleware,
  TransactionMiddleware,
} from "@smile/lib/middlewares"
import { Consumer } from "@smile/lib/rabbitmq"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { getConnection } from "./common/infrastructure/mq/index.js"
import { AuthMiddleware } from "./common/middlewares/auth.middleware.js"
import { RoleMiddleware } from "./common/middlewares/role-validation.middleware.js"
import env from "./config/env.js"
import { ActivityController } from "./modules/activity/activity.controller.js"
import { ActivityMiddleware } from "./modules/activity/activity.middleware.js"
import { ActivityModule } from "./modules/activity/activity.module.js"
import { ActivityRepository } from "./modules/activity/activity.repository.js"
import { BudgetSourceController } from "./modules/budget-source/budget-source.controller.js"
import { BudgetSourceModule } from "./modules/budget-source/budget-source.module.js"
import { BudgetSourceRepository } from "./modules/budget-source/budget-source.repository.js"
import { EntityActivityController } from "./modules/entity-activity/entity-activity.controller.js"
import { EntityActivityMiddleware } from "./modules/entity-activity/entity-activity.middleware.js"
import { EntityActivityModule } from "./modules/entity-activity/entity-activity.module.js"
import { EntityActivityRepository } from "./modules/entity-activity/entity-activity.repository.js"
import { EntityCustomerController } from "./modules/entity-customer/entity-customer.controller.js"
import { EntityCustomerMiddleware } from "./modules/entity-customer/entity-customer.middleware.js"
import { EntityCustomerModule } from "./modules/entity-customer/entity-customer.module.js"
import { EntityCustomerRepository } from "./modules/entity-customer/entity-customer.repository.js"
import { EntityMaterialController } from "./modules/entity-material/entity-material.controller.js"
import { EntityMaterialExcelController } from "./modules/entity-material/entity-material.excel.controller.js"
import { EntityMaterialExcelMiddleware } from "./modules/entity-material/entity-material.excel.middleware.js"
import { EntityMaterialExcelModule } from "./modules/entity-material/entity-material.excel.module.js"
import { EntityMaterialMiddleware } from "./modules/entity-material/entity-material.middleware.js"
import { EntityMaterialModule } from "./modules/entity-material/entity-material.module.js"
import { EntityMaterialRepository } from "./modules/entity-material/entity-material.repository.js"
import { EntityTagController } from "./modules/entity-tag/entity-tag.controller.js"
import { EntityTagModule } from "./modules/entity-tag/entity-tag.module.js"
import { EntityTagRepository } from "./modules/entity-tag/entity-tag.repository.js"
import { EntityTypeController } from "./modules/entity-type/entity-type.controller.js"
import { EntityTypeModule } from "./modules/entity-type/entity-type.module.js"
import { EntityUserController } from "./modules/entity-user/entity-user.controller.js"
import { EntityUserModule } from "./modules/entity-user/entity-user.module.js"
import { EntityUserRepository } from "./modules/entity-user/entity-user.repository.js"
import { EntityVendorController } from "./modules/entity-vendor/entity-vendor.controller.js"
import { EntityVendorModule } from "./modules/entity-vendor/entity-vendor.module.js"
import { EntityVendorRepository } from "./modules/entity-vendor/entity-vendor.repository.js"
import { EntityController } from "./modules/entity/entity.controller.js"
import { EntityModule } from "./modules/entity/entity.module.js"
import { EntityRepository } from "./modules/entity/entity.repository.js"
import { ManufactureController } from "./modules/manufacture/manufacture.controller.js"
import { ManufactureModule } from "./modules/manufacture/manufacture.module.js"
import { ManufactureRepository } from "./modules/manufacture/manufacture.repository.js"
import { MaterialActivityRepository } from "./modules/material-activity/material-activity.repository.js"
import { MaterialController } from "./modules/material/material.controller.js"
import { MaterialMiddleware } from "./modules/material/material.middleware.js"
import { MaterialModule } from "./modules/material/material.module.js"
import { MaterialRepository } from "./modules/material/material.repository.js"
import { ProvinceController } from "./modules/province/province.controller.js"
import { ProvinceModule } from "./modules/province/province.module.js"
import { ProvinceRepository } from "./modules/province/province.repository.js"
import { RegencyController } from "./modules/regency/regency.controller.js"
import { RegencyModule } from "./modules/regency/regency.module.js"
import { RegencyRepository } from "./modules/regency/regency.repository.js"
import { RoleRepository } from "./modules/role/role.repository.js"
import { SubDistrictController } from "./modules/sub-district/sub-district.controller.js"
import { SubDistrictModule } from "./modules/sub-district/sub-district.module.js"
import { SubDistrictRepository } from "./modules/sub-district/sub-district.repository.js"
import { VillageController } from "./modules/village/village.controller.js"
import { VillageModule } from "./modules/village/village.module.js"
import { VillageRepository } from "./modules/village/village.repository.js"

// inject dependencies
const mq = getConnection
const trxManager = new TransactionManager(db)
const userConsumer = new Consumer(
  mq,
  trxManager,
  `user-queue-${env.WORKSPACE_ID}`
)
const budgetSourceConsumer = new Consumer(
  mq,
  trxManager,
  `budget-source-queue-${env.WORKSPACE_ID}`
)
const manufactureConsumer = new Consumer(
  mq,
  trxManager,
  `manufacture-queue-${env.WORKSPACE_ID}`
)
const entityConsumer = new Consumer(
  mq,
  trxManager,
  `entity-queue-${env.WORKSPACE_ID}`
)

const userRepo = new UserRepository()
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

const trxMiddleware = new TransactionMiddleware(trxManager)
const authMiddleware = new AuthMiddleware(userRepo)
const requestMiddleware = new RequestMiddleware()
const excelMiddleware = new ExcelMiddleware()
const roleMiddleware = new RoleMiddleware()

const userModule = new UserModule(userRepo, entityRepo, roleRepo)
const userController = new UserController(userModule, excelMiddleware)
userController.registerWorkers(userConsumer)

const materialModule = new MaterialModule(
  materialRepo,
  activityRepo,
  manufactureRepo,
  userRepo
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
  materialRepo
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
const entityModule = new EntityModule(entityRepo)
const entityController = new EntityController(
  entityModule,
  excelMiddleware,
  roleMiddleware
)
entityController.registerWorkers(entityConsumer)

// Entity Customer
const entityCustomerModule = new EntityCustomerModule(entityCustomerRepository)
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
const entityUserController = new EntityUserController(
  entityUserModule,
  roleMiddleware
)

// Entity Activity
const entityActivityModule = new EntityActivityModule(entityActivityRepository)
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
const entityTypeModule = new EntityTypeModule()
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
const activityModule = new ActivityModule(activityRepo, userRepo)
const activityMiddleware = new ActivityMiddleware(activityRepo)
const activityController = new ActivityController(
  activityModule,
  activityMiddleware,
  excelMiddleware
)

// Budget-source
const budgetSourceModule = new BudgetSourceModule(budgetSourceRepo, userRepo)
const budgetSourceController = new BudgetSourceController(
  budgetSourceModule,
  excelMiddleware
)
budgetSourceController.registerWorkers(budgetSourceConsumer)

// Manufacture
const manufactureModule = new ManufactureModule(manufactureRepo, userRepo)
const manufactureController = new ManufactureController(manufactureModule)
manufactureController.registerWorkers(manufactureConsumer)

const fallbackModule = new FallbackModule()
const fallbackController = new FallbackController(fallbackModule)

// Main App routes
const mainApp = new Hono()
mainApp.use(cors())
mainApp.use("*", requestMiddleware.handle)
mainApp.use("*", trxMiddleware.handle)
// mainApp.use("*", authMiddleware.handle)
mainApp.use("*", authMiddleware.checkUserFromCore)

mainApp.route("/materials", materialController.getRoutes())
mainApp.route("/entities", entityMaterialController.getRoutes())
mainApp.route("/activities", activityController.getRoutes())
mainApp.route("/v2", activityController.getRoutes())
mainApp.route(
  "/entities-materials-bulk",
  entityMaterialExcelController.getRoutes()
)
mainApp.route("/entities", entityController.getRoutes())
mainApp.route("/entities", entityCustomerController.getRoutes())
mainApp.route("/entities", entityVendorController.getRoutes())
mainApp.route("/entities", entityUserController.getRoutes())
mainApp.route("/entities", entityActivityController.getRoutes())
mainApp.route("/entity-tags", entityTagController.getRoutes())
mainApp.route("/entity-types", entityTypeController.getRoutes())
mainApp.route("/provinces", provinceController.getRoutes())
mainApp.route("/regencies", regencyController.getRoutes())
mainApp.route("/subdistricts", subDistrictController.getRoutes())
mainApp.route("/villages", villageController.getRoutes())
mainApp.route("/users", userController.getRoutes())
mainApp.route("/budget-sources", budgetSourceController.getRoutes())
mainApp.route("/manufactures", manufactureController.getRoutes())

// fallback for unimplemented module
mainApp.all("*", fallbackController.handle)

export {
  budgetSourceConsumer,
  entityConsumer,
  mainApp,
  manufactureConsumer,
  userConsumer
}

