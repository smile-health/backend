import { Context } from "hono"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { EventReportStatusRepository } from "@/modules/event-report-status/event-report-status.repository.js"
import { EventReportHistoryRepository } from "@/modules/event-report-history/event-report-history.repository.js"
import { EventReportReasonRepository } from "@/modules/event-report-reason/event-report-reason.repository.js"
import {
  CreateEventReportSchema,
  CreateEventReportRequest,
  UpdateEventReportSchema,
  UpdateEventReportRequest,
  UpdateLinkEventReportSchema,
  UpdateLinkEventReportRequest,
} from "./event-report.schema.js"
import { z } from "zod"
import { EventReportRepository } from "./event-report.repository.js"
import {
  FLOW_STATUS_UPDATE,
  getNextStatusOptions,
  DraftStatusValues,
} from "@/common/constants/event-report.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { BadRequestError, NotFoundError } from "@smile/lib/error.js"

export class EventReportMiddleware {
  constructor(
    private readonly entityRepo: EntityRepository,
    private readonly repo: EventReportRepository,
    private readonly eventReportStatusRepo: EventReportStatusRepository,
    private readonly eventReportHistoryRepo: EventReportHistoryRepository,
    private readonly eventReportReasonRepo: EventReportReasonRepository
  ) {}

  createSchemaEventReport = (c: Context) => {
    return CreateEventReportSchema.superRefine(
      async (data: CreateEventReportRequest, ctx: z.RefinementCtx) => {
        await Promise.all([
          this.#checkEntity(c, ctx, data),
          this.#checkOrderId(c, ctx, data),
          this.#checkReasonIdProgram(c, ctx, data),
        ])

        for (const [index, item] of data.items.entries()) {
          await this.#checkMaterial(
            c,
            ctx,
            item.material_id ?? null,
            ["items", index.toString(), "material_id"],
            item.custom_material ?? null
          )
        }
      }
    )
  }

  updateSchemaEventReport = (c: Context) => {
    return UpdateEventReportSchema.superRefine(
      async (data: UpdateEventReportRequest, ctx: z.RefinementCtx) => {
        await Promise.all([
          this.#checkFlowStatusUpdate(c, ctx, data),
          this.#checkEventReport(c),
          this.#checkEventReportFollowupUpdate(c, ctx, data),
        ])
      }
    )
  }

  updateSchemaEventReportLink = (c: Context) => {
    return UpdateLinkEventReportSchema.superRefine(
      async (data: UpdateLinkEventReportRequest, ctx: z.RefinementCtx) => {
        await this.#checkStatusAllowedWhenUpdateLink(c, ctx)
      }
    )
  }

  readonly #checkEntity = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateEventReportRequest
  ) => {
    if (USER_ROLE.SUPERADMIN || USER_ROLE.ADMIN) {
      const result = await this.entityRepo.findOne(c, {
        id: data.entity_id,
      })

      if (!result) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `validator.not_exist`,
          path: ["entity_id"],
        })
      }
    } else if (data.entity_id !== c.var.userEntity.id && USER_ROLE.MANAGER) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `validator.not_exist`,
        path: ["entity_id"],
      })
    }
  }

  readonly #checkOrderId = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateEventReportRequest
  ) => {
    if (data.has_order === 1 && data.order_id) {
      const result = await this.repo.getOrderById(
        c,
        Number(data.order_id),
        Number(c.var.programId)
      )

      if (!result) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `validator.not_exist`,
          path: ["order_id"],
        })
      }
    }
  }

  readonly #checkMaterial = async (
    c: Context,
    ctx: z.RefinementCtx,
    materialId: number | null,
    path: string | (string | number)[],
    customMaterial: string | null
  ) => {
    const issuePath = Array.isArray(path) ? path : [path]
    if (customMaterial && materialId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `validator.event_report_material_id_is_null`,
        path: issuePath,
      })
      return
    }

    if (materialId && !customMaterial) {
      const result = await this.repo.getMaterialProgramById(
        c,
        materialId,
        Number(c.var.programId)
      )

      if (!result) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `validator.not_exist`,
          path: issuePath,
        })
      }
    }
  }

  readonly #checkFlowStatusUpdate = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: UpdateEventReportRequest
  ) => {
    const roleId = c.var.roleId
    const reportId = c.req.param("id")
    FLOW_STATUS_UPDATE.forEach((flow) => {
      if (flow.status === data.update_status_id) {
        const allowedRoles = flow.roles.includes(Number(roleId))
        if (!allowedRoles) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: c.var.t(`auth.forbidden`),
            path: ["status"],
          })
        }
      }
    })

    const dataHistory = await this.repo.getHistoryChangeStatusByReportId(
      c,
      Number(reportId),
      data.update_status_id
    )

    if (dataHistory) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: c.var.t(`validator.status_event_report_has_been_changed`),
        path: ["update_status_id"],
      })
    }
  }

  readonly #checkReasonIdProgram = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: CreateEventReportRequest
  ) => {
    const reasonIds = [...new Set(data.items.map((item) => item.reason_id))]
    const result = await this.eventReportReasonRepo.getEventReportReason(
      c,
      Number(c.var.programId),
      reasonIds
    )

    for (const [itemIndex, item] of data.items.entries()) {
      const findParentReason = result.find(
        (reason) => reason.id === item.reason_id
      )

      if (findParentReason) {
        const findChildReason = findParentReason.child.find(
          (reason) => reason.id === item.child_reason_id
        )
        if (!findChildReason) {
          const issuePath = ["items", itemIndex.toString(), "child_reason_id"]
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `validator.not_exist`,
            path: issuePath,
          })
        }
      } else if (!findParentReason) {
        const issuePath = ["items", itemIndex.toString(), "reason_id"]
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `validator.not_exist`,
          path: issuePath,
        })
      }
    }
  }

  readonly #checkEventReportFollowupUpdate = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: UpdateEventReportRequest
  ) => {
    const roleId = c.var.roleId
    const reportId = c.req.param("id")

    const history =
      await this.eventReportHistoryRepo.getLatestStatusChangeHistory(
        c,
        Number(reportId)
      )

    const nextStatusAllowed = getNextStatusOptions(
      history?.status_id as DraftStatusValues,
      Number(roleId)
    )

    if (
      nextStatusAllowed !== undefined &&
      !nextStatusAllowed.nextStatus.includes(
        Number(data?.update_status_id) as DraftStatusValues
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `validator.change_status_not_allowed`,
        path: ["update_status_id"],
      })
    }

    if (nextStatusAllowed?.addOrUpdatePackagingSlip === true) {
      const result = await this.repo.findOne(c, { id: Number(reportId) })
      if (result?.link === null) {
        const messageErrorLink = c.var.t("validator.not_empty", {
          field: c.var.t("event_report.label.packing_slip_link"),
        })
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: messageErrorLink,
          path: ["link"],
        })
        throw new BadRequestError(messageErrorLink)
      }
    }
  }

  readonly #checkEventReport = async (c: Context) => {
    const id = c.req.param("id")
    const result = await this.repo.findOne(c, { id: Number(id) })
    if (!result) {
      throw new NotFoundError("Event Report not found")
    }
  }

  readonly #checkStatusAllowedWhenUpdateLink = async (
    c: Context,
    ctx: z.RefinementCtx
  ) => {
    const id = c.req.param("id")
    const roleId = Number(c.var.roleId)
    const result = await this.repo.findOne(c, { id: Number(id) })

    if (!result) {
      throw new NotFoundError("Event Report not found")
    }

    if (result.status_id) {
      const nextStatusAllowed = getNextStatusOptions(
        result.status_id as DraftStatusValues,
        roleId
      )

      if (nextStatusAllowed?.addOrUpdatePackagingSlip !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `validator.change_update_packaging_slip_not_allowed`,
          path: ["link"],
        })
      }
    }
  }
}
