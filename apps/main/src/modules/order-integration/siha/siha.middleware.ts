import { DEVICE_TYPE } from "@/common/constants/device.js"
import { ORDER_REASON } from "@/common/constants/order.js"
import { ActivityRepository } from "@/modules/activity/activity.repository.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { ChangeOrderStatusCancelRequest } from "@/modules/order-status/order-status-cancel/order-status-cancel.schema.js"
import { ChangeOrderStatusConfirmRequest } from "@/modules/order-status/order-status-confirm/order-status-confirm.schema.js"
import { CreateOrderRequest } from "@/modules/order/order.schema.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { AuthKeycloakService } from "@smile/lib/api/auth.service.js"
import { NotFoundError, ValidationError } from "@smile/lib/error.js"
import { logger } from "@smile/lib/logger.js"
import { WorkspaceConfig } from "@smile/lib/types/jwt.js"
import { collect } from "@smile/lib/utils.js"
import { createMiddleware } from "hono/factory"
import moment from "moment"
import { SihaContext } from "./siha.context.js"
import { SihaRepository } from "./siha.repository.js"
import {
  CancelOrderRequest,
  ConfirmOrderRequest,
  CreateOrderRequest as IntegrationCreateOrderRequest,
} from "./siha.schemas.js"
export class SihaMiddleware {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly activityRepo: ActivityRepository,
    private readonly entityRepo: EntityRepository,
    private readonly repo: SihaRepository,
    private readonly authService: AuthKeycloakService
  ) {}

  public authorize = createMiddleware(async (c: SihaContext, next) => {
    try {
      const authHeader = c.req.header("Authorization")
      const token = authHeader?.split(" ")[1]

      if (!token) {
        logger.error(`token not found in header: ${token} - ${authHeader}`)
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }

      const authResp = await this.authService.validateToken(token)
      const user = await this.userRepo.getUserWithWorkspaceByKeycloakId(
        c,
        authResp?.userInfo?.sub
      )

      if (user.length == 0) {
        logger.error(`user not found`)
        return c.json({ message: c.var.t("auth.unauthorized") }, 401)
      }

      // handle client users (siha/sitb/din)
      const clientKey = Object.keys(authResp?.userInfo?.resource_access).filter(
        (key) => key !== "account"
      )[0]
      const client = await this.repo.getClientByKey(c, clientKey)

      // fill programId if not sent via headers only for client users
      if (client) {
        c.set("client", client)
        c.set("programId", c.var.programId ?? user[0]?.program_id)
      }

      const workspace = user.find(
        (ws) => ws.program_id == Number(c.var.programId)
      )

      if (!workspace) {
        return c.json({ message: c.var.t("auth.not_access_program") }, 403)
      }

      if (!workspace || workspace.status == 0) {
        return c.json({ message: c.var.t("auth.not_active_program") }, 403)
      }

      const programConfig = JSON.parse(
        JSON.stringify(workspace.program_config)
      ) as WorkspaceConfig

      c.set("user", workspace)
      c.set("userId", Number(workspace.id))
      c.set("roleId", workspace.role ?? 0)
      c.set("roles", authResp?.userInfo?.realm_access?.roles)
      c.set("resource_access", authResp?.userInfo?.resource_access)
      c.set("config", programConfig)

      const activities = await this.activityRepo.find(c, {})

      const userEntity = await this.entityRepo.findOne(c, {
        id: workspace.entity_id,
      })
      if (!userEntity) {
        logger.error(`${c.var.t("auth.has_no_entitas_program")}`)
        return c.json({ message: c.var.t("auth.has_no_entitas_program") }, 401)
      }

      c.set("activityIds", collect(activities, "id"))
      c.set("entityId", workspace.entity_id)
      c.set("userEntity", userEntity)
      c.set("deviceType", DEVICE_TYPE[c.req.header("Device-Type") ?? "web"])

      const timezoneHeader = c.req.header("Timezone") ?? ""
      const tz = moment.tz.zone(timezoneHeader) ? timezoneHeader : "Etc/UTC"
      c.set("timeZone", tz)
    } catch (error) {
      logger.error(`failed auth main: ${JSON.stringify(error)}`)
      return c.json({ message: "Expired Token" }, 401)
    }

    await next()
  })

  logRequest = createMiddleware(async (c: SihaContext, next) => {
    await next()

    const { orderId, client, requestType } = c.var
    if (!requestType) {
      return
    }

    const res = c.res.clone()
    await this.repo.createLog({
      client_id: client.id,
      source_id: orderId,
      source_type: "order",
      flow: "in",
      tag: requestType,
      request: JSON.stringify({
        method: c.req.method,
        url: c.req.url,
        body: await c.req.text(),
      }),
      response: JSON.stringify({
        status: res.status,
        body: await res.text(),
        error: c.error,
      }),
    })
  })

  validateOrder = createMiddleware(async (c: SihaContext, next) => {
    c.set("requestType", "get_order")

    const keySsl = c.req.param("key_ssl")
    const orderId = await this.repo.getInternalId(c, "order", keySsl)
    if (!orderId) {
      throw new NotFoundError("Order not found")
    }

    c.set("orderId", orderId)

    return next()
  })

  prepareCreateRequest = createMiddleware(async (c: SihaContext, next) => {
    c.set("requestType", "create_order")

    const req = await c.req.json<IntegrationCreateOrderRequest>()
    const { client, programId } = c.var
    const entityIds = [req.customer_id, req.vendor_id]
    const materialIds = req.order_items.map((item) => item.kode_kfa)

    const [activityId, orderId] = await Promise.all([
      this.repo.getInternalId(c, "activity", req.activity_code),
      this.repo.getInternalId(c, "order", req.key_ssl),
    ])

    if (!activityId) {
      throw new ValidationError("Activity not found")
    }

    if (orderId) {
      throw new ValidationError(`Order ${orderId} already exists`)
    }

    if (req.order_items.length === 0) {
      throw new ValidationError("Order items must contain at least 1 item")
    }

    const [entityMappings, materialMappings] = await Promise.all([
      this.repo.getEntityMappings(c, programId, entityIds),
      this.repo.getMaterialMappings(c, programId, materialIds),
    ])

    for (const item of req.order_items) {
      if (!materialMappings[item.kode_kfa]) {
        throw new ValidationError(
          `Material with kfa code ${item.kode_kfa} not found`
        )
      }
    }

    if (!entityMappings[req.customer_id]) {
      throw new ValidationError(`Customer with id ${req.customer_id} not found`)
    }

    if (!entityMappings[req.vendor_id]) {
      throw new ValidationError(`Vendor with id ${req.vendor_id} not found`)
    }

    const createRequest: CreateOrderRequest = {
      order_type_id: req.type,
      customer_id: entityMappings[req.customer_id] ?? 0,
      vendor_id: entityMappings[req.vendor_id] ?? 0,
      activity_id: activityId,
      is_allocated: 1,
      taken_by_customer: 0,
      metadata: JSON.stringify({
        client_key: client.key,
        key_ssl: req.key_ssl,
        category: req.category,
        total_patients: req.total_patients,
      }),
      order_items: req.order_items.map((item) => ({
        order_reason_id: ORDER_REASON.EMPTY,
        material_id:
          materialMappings[item.kode_kfa]?.parent_id ??
          materialMappings[item.kode_kfa]?.id ??
          0,
        ordered_qty: item.ordered_qty,
        children: materialMappings[item.kode_kfa]?.parent_id
          ? [
              {
                material_id: materialMappings[item.kode_kfa]?.id ?? 0,
                ordered_qty: item.ordered_qty,
              },
            ]
          : [],
        metadata: JSON.stringify({
          kode_kfa: item.kode_kfa,
          external_order_item_id: item.external_order_item_id,
        }),
      })),
    }
    c.set("createRequest", createRequest)

    return next()
  })

  prepareConfirmRequest = createMiddleware(async (c: SihaContext, next) => {
    const req: ConfirmOrderRequest = await c.req.json()
    const mapOrderItems = await this.repo.getMapOrderItemIdByKFACode(
      c,
      c.var.orderId
    )
    const confirmRequest: ChangeOrderStatusConfirmRequest = {
      comment: req.comment,
      order_items: req.order_items.map((item) => ({
        id: mapOrderItems[item.kode_kfa] ?? 0,
        confirmed_qty: item.confirmed_qty,
      })),
    }
    c.set("confirmRequest", confirmRequest)
    c.set("requestType", "confirm_order")

    return next()
  })

  prepareCancelRequest = createMiddleware(async (c: SihaContext, next) => {
    const req: CancelOrderRequest = await c.req.json()
    const cancelRequest: ChangeOrderStatusCancelRequest = {
      order_cancel_reason_id: req.cancel_reason,
      other_reason: req.other_reason,
    }
    c.set("cancelRequest", cancelRequest)
    c.set("requestType", "cancel_order")

    return next()
  })
}
