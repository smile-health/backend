import { type Context } from "hono"
import SismalRepository from "./sismal.repository.js"
import {
  SismalOrdersQueriesType,
  SismalOrdersResponseType,
  SismalTransactionResponseType,
  SismalTransactionsQueriesType,
} from "./sismal.schema.js"

export class SismalModule {
  constructor(private readonly repo: SismalRepository) {}

  async getAllTransactions(
    c: Context,
    params: SismalTransactionsQueriesType
  ): Promise<SismalTransactionResponseType> {
    const result = await this.repo.getAllTransactions(c, params)

    const transformedData = result.data.map((item) => ({
      entity: {
        code: item.entity_code,
        id_satu_sehat: item.entity_id_satu_sehat,
        name: item.entity_name,
      },
      master_material: {
        code: item.material_code,
        kfa_code: item.material_kfa_code,
        name: item.material_name,
      },
      transaction_reason_id: item.transaction_reason_id,
      stock: {
        batch: {
          code: item.batch_code,
          expired_date: item.batch_expired_date?.toISOString() || null,
        },
      },
      change_qty: item.change_qty,
      user_created: {
        username: item.user_created_username,
      },
    }))

    return {
      total: result.total,
      page: result.page,
      perPage: result.paginate,
      list: transformedData,
    }
  }

  async getAllOrders(
    c: Context,
    params: SismalOrdersQueriesType
  ): Promise<SismalOrdersResponseType> {
    const result = await this.repo.getAllOrders(c, params)

    const ordersWithItems = await Promise.all(
      result.data.map(async (order) => {
        const orderItems = await this.repo.getOrderItems(c, order.id)

        return {
          created_at: order.created_at.toISOString(),
          id: order.id,
          status: order.status,
          total_order_item: order.total_order_item,
          customer: {
            code: order.customer_code,
            id_satu_sehat: order.customer_id_satu_sehat,
            name: order.customer_name,
            province_id: order.customer_province_id,
            regency_id: order.customer_regency_id,
          },
          vendor: {
            code: order.vendor_code,
            id_satu_sehat: order.vendor_id_satu_sehat,
            name: order.vendor_name,
          },
          order_items: orderItems.map((item) => ({
            id: item.id,
            qty: item.qty,
            master_material_id: item.master_material_id,
            master_material: {
              name: item.material_name,
              unit: item.material_unit,
              kfa_code: item.material_kfa_code,
              code: item.material_code,
            },
          })),
        }
      })
    )

    return {
      total: result.total,
      page: result.page,
      perPage: result.paginate,
      list: ordersWithItems,
    }
  }
}
