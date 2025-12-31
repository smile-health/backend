import { DisposalInstructionController } from "./disposal-instruction.controller.js"
import { DisposalInstructionService } from "./disposal-instruction.service.js"
import { DisposalInstructionRepository } from "./disposal-instruction.repository.js"
import { DisposalInstructionMiddleware } from "./disposal-instruction.middleware.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { CommonMiddleware } from "@/common/middlewares/common.middleware.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { ActivityRepository } from "@/modules/activity/activity.repository.js"
import { MaterialRepository } from "@/modules/material/material.repository.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"
import { IntegrationRepository } from "../integration/integration.repository.js"

export class DisposalInstructionModule {
  public readonly repository: DisposalInstructionRepository
  public readonly service: DisposalInstructionService
  public readonly middleware: DisposalInstructionMiddleware
  private readonly controller: DisposalInstructionController

  constructor() {
    const integrationRepo = new IntegrationRepository()
    this.repository = new DisposalInstructionRepository()
    this.service = new DisposalInstructionService(this.repository, 
      new EntityRepository(),
      new MaterialRepository(),
      new ActivityRepository(),
      new UserRepository(),
      integrationRepo,
    )
    this.middleware = new DisposalInstructionMiddleware(this.repository, integrationRepo)
    
    const roleMiddleware = new RoleMiddleware()
    const commonMiddleware = new CommonMiddleware()
    const excelMiddleware = new ExcelMiddleware()
    this.controller = new DisposalInstructionController(
      this.service,
      this.middleware,
      roleMiddleware,
      commonMiddleware,
      excelMiddleware
    )
  }

  getController(): DisposalInstructionController {
    return this.controller
  }
}