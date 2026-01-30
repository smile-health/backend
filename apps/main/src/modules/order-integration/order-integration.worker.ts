// Temporary Order Interoperability for SMILE 5.0

import { DB, WsUsers } from "@/common/infrastructure/database/types/db.js"
import { redis } from "@/common/infrastructure/redis.js"
import { BadRequestError, RetriableError } from "@smile-health/lib/error.js"
import { logger } from "@smile-health/lib/logger.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { sleep } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { Selectable } from "kysely"
import { OrderIntegrationRepository } from "./order-integration.repository.js"
import {
  Action,
  canCancelOrder,
  canReceiveOrder,
  canValidateOrder,
  Payload,
} from "./type.js"

const MAX_RETRY = 3
const RETRY_DELAY = 5000

export class OrderIntegrationWorker {
  constructor(private readonly repo: OrderIntegrationRepository) {}

  registerWorkers = (consumer: Consumer<DB>) => {
    consumer.route(TOPIC.ORDER_STATUS_ORDER_VALIDATED, async (c, msg) => {
      const { payload, user } = JSON.parse(msg ?? "{}") as {
        payload: Payload
        user: Selectable<WsUsers>
      }
      const ctx = c as Context
      Object.assign(ctx.var, { user })

      if (payload.retry === true) {
        await this.doRetry(ctx, "validate", payload)
      } else {
        await this.doRequest(ctx, "validate", payload)
      }
    })

    consumer.route(TOPIC.ORDER_STATUS_ORDER_FULFILLED, async (c, msg) => {
      const { payload, user } = JSON.parse(msg ?? "{}") as {
        payload: Payload
        user: Selectable<WsUsers>
      }
      const ctx = c as Context
      Object.assign(ctx.var, { user })

      if (payload.retry === true) {
        await this.doRetry(ctx, "receive", payload)
      } else {
        await this.doRequest(ctx, "receive", payload)
      }
    })

    consumer.route(TOPIC.ORDER_STATUS_ORDER_CANCEL, async (c, msg) => {
      const { payload, user } = JSON.parse(msg ?? "{}") as {
        payload: Payload
        user: Selectable<WsUsers>
      }
      const ctx = c as Context
      Object.assign(ctx.var, { user })
      if (payload.retry === true) {
        await this.doRetry(ctx, "cancel", payload)
      } else {
        await this.doRequest(ctx, "cancel", payload)
      }
    })
  }

  readonly doRequest = async (c: Context, action: Action, payload: Payload) => {
    const { order, items } = await this.repo.getOrderMetadata(
      c,
      payload.order_id
    )
    const orderMetadata = order?.metadata as object
    if (!orderMetadata) {
      return
    }

    const user = c.var.user
    const client = await this.repo.getClientGateway(
      c,
      orderMetadata["client_key"]
    )
    const req = { order, items, payload, user }
    const res = await this.doAction(client, action, req)

    if (!res) return

    await this.repo.createLog({
      client_id: client.getClientID(),
      source_id: payload.order_id,
      source_type: "order",
      flow: "out",
      tag: `${action}_order`,
      request: JSON.stringify(res.request),
      response: JSON.stringify(res.response),
    })

    return res.response
  }

  private readonly doRetry = async (
    c: Context,
    action: Action,
    payload: Payload
  ) => {
    const { order, items } = await this.repo.getOrderMetadata(
      c,
      payload.order_id
    )
    const orderMetadata = order?.metadata as object
    if (!orderMetadata) {
      return
    }

    const user = c.var.user
    const client = await this.repo.getClientGateway(
      c,
      orderMetadata["client_key"]
    )
    const req = { order, items, payload, user }
    const res = await this.doAction(client, action, req)

    if (!res) return

    const update = {
      client_id: client.getClientID(),
      source_id: payload.order_id,
      source_type: "order",
      flow: "out",
      tag: `${action}_order`,
      request: JSON.stringify(res.request),
      response: JSON.stringify(res.response),
      updated_at: new Date(),
    }

    await this.repo.updateLog(c, payload.id ?? 0, update)
    return res.response
  }

  private readonly doAction = (
    client: unknown,
    action: Action,
    req: object
  ) => {
    if (action === "validate" && canValidateOrder(client)) {
      return client.validateOrder(req)
    } else if (action === "receive" && canReceiveOrder(client)) {
      return client.receiveOrder(req)
    } else if (action === "cancel" && canCancelOrder(client)) {
      return client.cancelOrder(req)
    }
  }
}
