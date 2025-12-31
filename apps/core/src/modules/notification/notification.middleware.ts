import { BaseMiddleware } from "@smile/lib/base/middleware.js"
import { Context } from "hono"
import { z } from "zod"
import { NotificationRepository } from "./notification.repository.js"
import {
  GetNotificationsQueryParamsSchema,
  GetNotificationsQueryParams,
  GetNotificationParamSchema,
} from "./notification.schema.js"

export class NotificationMiddleware extends BaseMiddleware {
  constructor(private readonly repository: NotificationRepository) {
    super()
  }

  readonly #getlocation = async (c: Context, id: number, level: number) => {
    const location = await this.repository.getLocationById(c, Number(id), level)
    return location
  }

  readonly #getEntityTags = async (c: Context, ids: number[]) => {
    const entityTags = await this.repository.getEntityTagByIds(c, ids)
    return entityTags
  }

  readonly #getPrograms = async (c: Context, ids: number[]) => {
    const programs = await this.repository.getProgramByIds(c, ids)
    return programs
  }

  readonly #getEntity = async (c: Context, id: number) => {
    const entity = await this.repository.getEntityById(c, Number(id))
    return entity
  }

  readonly #getNotification = async (id: number) => {
    const notification = await this.repository.getNotificationById(Number(id))
    return notification
  }

  readonly #locationIdNotExist = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: GetNotificationsQueryParams
  ) => {
    if (data.province_id) {
      const province = await this.#getlocation(c, data.province_id, 0)
      if (!province) {
        ctx.addIssue({
          path: ["province_id"],
          code: z.ZodIssueCode.custom,
          message: "validator.not_exist",
        })
      }
    }

    if (data.city_id) {
      const city = await this.#getlocation(c, data.city_id, 1)
      if (!city) {
        ctx.addIssue({
          path: ["city_id"],
          code: z.ZodIssueCode.custom,
          message: "validator.not_exist",
        })
      }
    }
  }

  readonly #entityTagIdsNotExist = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: GetNotificationsQueryParams
  ) => {
    if (data.entity_tag_ids) {
      const entityTags = await this.#getEntityTags(c, data.entity_tag_ids)
      if (data.entity_tag_ids.length !== entityTags.length) {
        ctx.addIssue({
          path: ["entity_tag_ids"],
          code: z.ZodIssueCode.custom,
          message: "validator.not_exist",
        })
      }
    }
  }

  readonly #programIdsNotExist = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: GetNotificationsQueryParams
  ) => {
    if (data.program_ids) {
      const programs = await this.#getPrograms(c, data.program_ids)
      if (data.program_ids.length !== programs.length) {
        ctx.addIssue({
          path: ["program_ids"],
          code: z.ZodIssueCode.custom,
          message: "validator.not_exist",
        })
      }
    }
  }

  readonly #healthCenterIdNotExist = async (
    c: Context,
    ctx: z.RefinementCtx,
    data: GetNotificationsQueryParams
  ) => {
    if (data.health_center_id) {
      const healthCenter = await this.#getEntity(c, data.health_center_id)
      if (!healthCenter) {
        ctx.addIssue({
          path: ["health_center_id"],
          code: z.ZodIssueCode.custom,
          message: "validator.not_exist",
        })
      }
    }
  }

  readonly #updateSingleReadCheck = async (
    ctx: z.RefinementCtx,
    id: number
  ) => {
    const notification = await this.#getNotification(id)

    if (!notification) {
      ctx.addIssue({
        path: ["id"],
        code: z.ZodIssueCode.custom,
        message: "validator.not_exist",
      })
    }

    if (notification && notification.read_at) {
      ctx.addIssue({
        path: ["id"],
        code: z.ZodIssueCode.custom,
        message: "validator.has_marked_as_read",
      })
    }
  }

  list = (c: Context) => {
    return GetNotificationsQueryParamsSchema.superRefine(async (data, ctx) => {
      await this.#locationIdNotExist(c, ctx, data)
      await this.#entityTagIdsNotExist(c, ctx, data)
      await this.#programIdsNotExist(c, ctx, data)
      await this.#healthCenterIdNotExist(c, ctx, data)
    })
  }

  updateSingleRead = () => {
    return GetNotificationParamSchema.superRefine(async (data, ctx) => {
      await this.#updateSingleReadCheck(ctx, data.id)
    })
  }
}
