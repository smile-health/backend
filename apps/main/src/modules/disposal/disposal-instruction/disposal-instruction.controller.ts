import { CommonMiddleware } from "@/common/middlewares/common.middleware.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"
import { Context, Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { DisposalInstructionMiddleware } from "./disposal-instruction.middleware.js"
import {
  CreateDisposalInstructionCommentRequest,
  CreateDisposalInstructionCommentSchema,
  CreateDisposalInstructionRequest,
  DisposalInstructionIdParamsSchema,
  DisposalInstructionListPaginatedRequestDTO,
  DisposalInstructionListPaginatedRequestSchema,
  DisposalInstructionTypesListPaginatedRequestSchema,
} from "./disposal-instruction.schema.js"
import { DisposalInstructionService } from "./disposal-instruction.service.js"

export class DisposalInstructionController extends BaseController {
  constructor(
    private readonly service: DisposalInstructionService,
    private readonly middleware: DisposalInstructionMiddleware,
    private readonly roleMiddleware: RoleMiddleware,
    private readonly commonMiddleware: CommonMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super("disposal/instructions")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.post(
      "/",
      this.middleware.validateCreateRequest,
      async (c: Context) => {
        const body = (await c.req.json()) as CreateDisposalInstructionRequest
        const response = await this.service.createInstruction(c, body)

        return c.json(response, StatusCodes.CREATED)
      }
    )

    router.get(
      "/",
      this.validateRequest(
        "query",
        DisposalInstructionListPaginatedRequestSchema
      ),
      async (c: Context) => {
        const query = c.req.query()
        const parsedQuery =
          DisposalInstructionListPaginatedRequestSchema.parse(query)
        const response = await this.service.getInstructionList(
          c,
          parsedQuery as DisposalInstructionListPaginatedRequestDTO
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    // Get disposal instruction types (moved before the :id route to avoid parameter conflicts)
    router.get(
      "/types",
      this.validateRequest(
        "query",
        DisposalInstructionTypesListPaginatedRequestSchema
      ),
      async (c: Context) => {
        const query = c.req.query()
        const parsedQuery =
          DisposalInstructionTypesListPaginatedRequestSchema.parse(query)
        const response = await this.service.getInstructionTypesList(
          c,
          parsedQuery
        )
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/xls",
      this.validateRequest(
        "query",
        DisposalInstructionListPaginatedRequestSchema
      ),
      this.excelMiddleware.handleExport,
      async (c: Context) => {
        const query = c.req.query()
        const parsedQuery =
          DisposalInstructionListPaginatedRequestSchema.parse(query)
        const file = await this.service.exportExcel(
          c,
          parsedQuery as DisposalInstructionListPaginatedRequestDTO
        )
        c.set("file", file)
      }
    )

    // Handover letter report download route
    router.get(
      "/:id/download",
      this.validateRequest("param", DisposalInstructionIdParamsSchema),
      this.excelMiddleware.handleExport,
      async (c: Context) => {
        const { id } = c.req.param()
        const instructionId = Number(id)
        const file = await this.service.generateHandoverLetterReport(
          c,
          instructionId
        )
        c.set("file", file)
      }
    )

    router.get(
      "/:id",
      this.middleware.validateInstructionId,
      this.middleware.checkInstructionExists,
      async (c: Context) => {
        const { id } = c.req.param()
        const instructionId = Number(id)
        const response = await this.service.getInstructionById(c, instructionId)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/:id/comment",
      this.validateRequest("param", DisposalInstructionIdParamsSchema),
      this.validateRequest("json", CreateDisposalInstructionCommentSchema),
      async (c: Context) => {
        const { id } = c.req.param()
        const instructionId = Number(id)
        const body =
          (await c.req.json()) as CreateDisposalInstructionCommentRequest
        await this.service.createInstructionComment(c, instructionId, body)
        return c.json({}, StatusCodes.CREATED)
      }
    )

    return router
  }
}
