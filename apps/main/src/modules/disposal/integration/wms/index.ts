import { db } from "@/common/infrastructure/database/index.js"
import { ActivityRepository } from "@/modules/activity/activity.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { MaterialRepository } from "@/modules/material/material.repository.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { AuthKeycloakService } from "@smile-health/lib/api/auth.service.js"
import { TransactionManager } from "@smile-health/lib/database.js"
import { TransactionMiddleware } from "@smile-health/lib/middlewares/transaction.middleware.js"
import { env } from "process"
import { DisposalInstructionRepository } from "../../disposal-instruction/disposal-instruction.repository.js"
import { DisposalInstructionService } from "../../disposal-instruction/disposal-instruction.service.js"
import { IntegrationRepository } from "../integration.repository.js"
import { WmsController } from "./wms.controller.js"
import { WmsMiddleware } from "./wms.middleware.js"
import { RequestMiddleware } from "@smile-health/lib/middlewares/request.middleware.js"

const trxManager = new TransactionManager(db)
const trxMiddleware = new TransactionMiddleware(trxManager)

const authRepo = new AuthKeycloakService(
  env.AUTH_URL ?? "http://localhost:5001"
)
const integrationRepo = new IntegrationRepository()
const userRepo = new UserRepository()

const disposalInstructionService = new DisposalInstructionService(
  new DisposalInstructionRepository(),
  new EntityRepository(),
  new MaterialRepository(),
  new ActivityRepository(),
  userRepo,
  integrationRepo
)

export const wmsApp = new WmsController(
  disposalInstructionService,
  new WmsMiddleware(integrationRepo, userRepo, authRepo),
  trxMiddleware,
  new RequestMiddleware(),
)
