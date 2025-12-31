/* eslint-disable @typescript-eslint/no-explicit-any */
import { BudgetSourceRepository } from "@/modules/budget-source/budget-source.repository.js"
import { OrderCentralDeliveryModule } from "@/modules/order-central-delivery/order-central-delivery.module.js"
import { OrderStatusCancelModule } from "@/modules/order-status/order-status-cancel/order-status-cancel.module.js"
import { AuthKeycloakService } from "@smile/lib/api/auth.service.js"
import { Context } from "hono"
import z from "zod"
import { DinContext } from "./din.context.js"
import { DinRepository } from "./din.repository.js"
import {
  CreateOrderDinRequest,
  LoginRequestSchema,
  WSMaterialSchema,
} from "./din.schemas.js"
import { ORDER_STATUS, ORDER_REASON } from "@/common/constants/order.js"

interface OutputStock {
  ordered_qty: number
  budget_year: string
  budget_source_id: string
  total_price: number
  expired_date: string | null
  manufacture_name?: string
  production_date: string | null
  batch_code?: string
}

interface OutputOrderItem {
  material_id: number
  is_managed_in_batch: boolean
  stocks: OutputStock[]
  metadata: any
}

export class DinModule {
  private isCancel: boolean = false
  private orderIdCancel: number = 0
  constructor(
    private readonly repo: DinRepository,
    private readonly budgetSourceRepo: BudgetSourceRepository,
    private readonly orderCentralDeliveryModule: OrderCentralDeliveryModule,
    protected readonly authRepo: AuthKeycloakService,
    protected readonly orderStatusCancelModule: OrderStatusCancelModule
  ) {}

  async create(c: DinContext, body: CreateOrderDinRequest) {
    // Preparation Data

    await this.#preparationMasterData(c, body)
  }

  async #preparationMasterData(c: DinContext, body: CreateOrderDinRequest) {
    // Validate Payload Request
    const validated = await this.#validatePayload(c, body)

    // 1. Search Manufacture Materials
    if (validated === false) {
      if (this.isCancel === true) {
        const payloadCancel = {
          order_reason: ORDER_REASON.OTHERS,
          comment: "Order Revision from DIN",
        }
        await this.orderStatusCancelModule.update(
          c,
          this.orderIdCancel,
          payloadCancel
        )
      }

      const manufactures = (
        await Promise.all(
          (c.var.dataExtra?.listMaterial as WSMaterialSchema[]).map(
            async (material) =>
              this.repo.getWsMaterialManufacture(
                c,
                material.id,
                c.var.programId
              )
          )
        )
      ).filter(Boolean)

      // 2. validate Budget Source
      const [budgetSource] = await Promise.all([
        this.#findOrCreateBudgetSource(
          c,
          body.sumber_dana ? body.sumber_dana : "APBN"
        ),
      ])

      const inputData = this.#transformData(c, body, budgetSource, manufactures)
      // return inputData
      // 3. Deliver to Module Central Delivery
      const orderId = await this.orderCentralDeliveryModule.create(c, inputData)
      c.set("orderId", orderId)
    } else {
      c.set("validate", validated)
    }
  }

  #transformData(
    c: DinContext,
    inputData: CreateOrderDinRequest,
    budgetSource,
    manufactures
  ) {
    const { dataExtra, client } = c.var
    const { data, ...orderData } = inputData

    const getCurrentDate = (): string => {
      const today = new Date()
      return today.toISOString().split("T")[0]!
    }

    const getBudgetYear = (): string => {
      return new Date().getFullYear().toString()
    }

    const findManufacture = (materialId: number): any => {
      return manufactures.find((m) => m.material_id === materialId)
    }

    const findMaterialByCode = (kfaCode: string) => {
      return dataExtra.listMaterial?.find((m) => m.code === kfaCode)
    }

    const materialGroups = new Map<number, OutputOrderItem>()

    data.forEach((item) => {
      const material = findMaterialByCode(item.kfa_code)
      const manufacture = material ? findManufacture(material.id) : undefined

      const isManagedInBatch = material
        ? material.is_managed_in_batch === 1
        : false
      const materialId = material ? material.id : 0

      const stock: OutputStock = {
        ordered_qty: item.qty,
        budget_year: getBudgetYear(),
        budget_source_id: budgetSource.id.toString(),
        total_price: item.total_price,
      }

      // Add batch-specific fields if material is managed in batch
      if (isManagedInBatch) {
        stock.expired_date = item.tgl_kadaluarsa || null
        stock.production_date = item.tgl_produksi || null
        stock.batch_code = item.lot_no
        if (manufacture) {
          stock.manufacture_name = manufacture.name
        }
      }

      // Check if material already exists in the group
      if (materialGroups.has(materialId)) {
        materialGroups.get(materialId)!.stocks.push(stock)
        materialGroups.get(materialId)!.metadata.push(JSON.stringify(item))
      } else {
        materialGroups.set(materialId, {
          material_id: materialId,
          is_managed_in_batch: isManagedInBatch,
          stocks: [stock],
          metadata: [JSON.stringify(item)],
        })
      }
    })

    const orderItems: OutputOrderItem[] = Array.from(materialGroups.values())

    return {
      vendor_id: dataExtra.detailEntitasVendor?.id,
      customer_id: dataExtra.detailEntitasCustomer?.id,
      activity_id: dataExtra.activityId,
      required_date: getCurrentDate(),
      order_comment: inputData.note || "From Din",
      po_number: inputData.ref_num,
      do_number: inputData.doc_num,
      delivery_type_id: 1, // Default value, adjust as needed
      metadata: JSON.stringify({ client_key: client.key, ...orderData }),
      order_items: orderItems,
    }
  }

  async #findOrCreateBudgetSource(c: DinContext, name: string) {
    const userId = c.var.user?.global_id
    const programId = c.var.programId

    let budgetSource = await this.budgetSourceRepo.findOne(c, {
      name,
    })

    if (!budgetSource) {
      // Create Budget Source
      const newBudgetSource = await this.repo.createBudgetSource(c, {
        name: name,
        description: null,
        created_by: userId,
        updated_by: userId,
      })

      // Create Budget Source Workspace
      await this.repo.createBudgetSourceWorkspace(c, {
        budget_source_id: Number(newBudgetSource.insertId),
        workspace_id: programId,
        is_related: 0,
      })

      budgetSource = await this.budgetSourceRepo.findOne(c, {
        name,
      })
    }
    return budgetSource
  }

  #comparePayload(payloadOld: any, payloadNew: any): boolean {
    // Handle null/undefined cases
    if (payloadOld === null && payloadNew === null) return true
    if (payloadOld === null || payloadNew === null) return false
    if (payloadOld === undefined && payloadNew === undefined) return true
    if (payloadOld === undefined || payloadNew === undefined) return false

    // Handle primitive types
    if (typeof payloadOld !== "object" || typeof payloadNew !== "object") {
      return payloadOld === payloadNew
    }

    // Handle arrays
    if (Array.isArray(payloadOld) && Array.isArray(payloadNew)) {
      if (payloadOld.length !== payloadNew.length) return false

      for (let i = 0; i < payloadOld.length; i++) {
        if (!this.#comparePayload(payloadOld[i], payloadNew[i])) {
          return false
        }
      }
      return true
    }

    // If one is array and other is not
    if (Array.isArray(payloadOld) || Array.isArray(payloadNew)) {
      return false
    }

    // Handle objects - Get all keys from both objects
    const keysOld = Object.keys(payloadOld).sort()
    const keysNew = Object.keys(payloadNew).sort()

    // Check if number of keys are different
    if (keysOld.length !== keysNew.length) {
      return false
    }

    // Check if all keys match
    for (let i = 0; i < keysOld.length; i++) {
      if (keysOld[i] !== keysNew[i]) {
        return false
      }
    }

    // Check each key and value
    for (const key of keysOld) {
      const valueOld = payloadOld[key]
      const valueNew = payloadNew[key]

      if (!this.#comparePayload(valueOld, valueNew)) {
        return false
      }
    }

    return true
  }

  async #validatePayload(c: DinContext, body: CreateOrderDinRequest) {
    const doc_num = body.doc_num

    const integrationLog = await this.repo.getIntegrationLogByJson(c, doc_num)

    if (!integrationLog || integrationLog.length === 0) {
      return false
    }

    const shippedLog = integrationLog.find(
      (il) => il.order_status_id === ORDER_STATUS.SHIPPED
    )
    if (shippedLog) {
      const payloadOld = shippedLog.body_content
      const payloadNew = body

      const isSame = this.#comparePayload(payloadOld, payloadNew)

      if (isSame) {
        return `Order has been shipped by SMILE with order ID: ${shippedLog.id}`
      } else {
        this.orderIdCancel = shippedLog.id
        this.isCancel = true
        return false
      }
    }

    const fulfilledLog = integrationLog.find(
      (il) => il.order_status_id === ORDER_STATUS.FULFILLED
    )
    if (fulfilledLog) {
      return `Order has been received by SMILE with order ID: ${fulfilledLog.id}`
    }

    const canceledLog = integrationLog.find(
      (il) => il.order_status_id === ORDER_STATUS.CANCELED
    )
    if (canceledLog) {
      return `Order has been canceled by SMILE with order ID: ${canceledLog.id}`
    }
  }

  async login(c: Context, req: z.infer<typeof LoginRequestSchema>) {
    const loginResp = await this.authRepo.login(req.username, req.password)

    return {
      access_token: loginResp.authDetails.access_token,
      token_type: "bearer",
      expires_in: loginResp.authDetails.expires_in / 60,
    }
  }
}
