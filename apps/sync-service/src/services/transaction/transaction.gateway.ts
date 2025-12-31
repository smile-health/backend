import { SERVER_URL } from "@/common/constant/url.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import {
  getExistingIds,
  getMapExistingIds,
  insertMapping,
} from "@/common/mapping.repository.js"
import { getSmile, PostV2TransactionsBodyItem } from "@/openapi/transaction.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { collect, merge } from "@smile/lib/utils.js"
import { AxiosError } from "axios"
import { Insertable } from "kysely"
import {
  CreateTransactionIncomingMessage,
  MAP_RABIES_SEQUENCE,
  MAP_TRANSACTION_TYPE,
} from "./transaction.schema.js"

export class TransactionGateway {
  /**
   * Update or create if we are missing data from mapping_entity_material_activities
   *
   * @param c
   * @param message
   */
  public async create(
    c: CustomContext<DB>,
    message: CreateTransactionIncomingMessage
  ) {
    try {
      const { payload, headers } = message

      const progId = payload[0]?.program_id ?? 1
      const materialIds = collect(payload, "material_id")
      const activityIds = collect(payload, "activity_id")
      const entityIds = merge(
        collect(payload, "entity_id"),
        collect(payload, "companion_entity_id")
      )
      const stockIds = collect(payload, "stock_id")
      const manufactureIds = collect(payload, "manufacture_id")
      const budgetSourceIds = collect(payload, "budget_source_id")
      const reasonIds = payload.map(
        (trx) => trx.discard?.reason_id ?? trx.transaction_reason_id ?? 0
      )

      const [
        mapEntityId,
        mapMaterialId,
        mapActivityId,
        mapStockId,
        mapManufactureId,
        mapBudgetSourceId,
        mapTrxReasonId,
      ] = await Promise.all([
        getMapExistingIds(c, "entities", entityIds, progId),
        getMapExistingIds(c, "materials", materialIds, progId),
        getMapExistingIds(c, "activities", activityIds, progId),
        getMapExistingIds(c, "stocks", stockIds, progId),
        getMapExistingIds(c, "manufactures", manufactureIds, progId),
        getMapExistingIds(c, "budget_sources", budgetSourceIds, progId),
        getMapExistingIds(c, "transaction_reasons", reasonIds, progId),
      ])

      const req: PostV2TransactionsBodyItem[] = await Promise.all(
        payload
          .filter((trx) => !trx.rabies?.is_other_sequence)
          .map(async (trx) => ({
            transaction_id: await getExistingIds(
              c,
              "transactions",
              trx.transaction_ids,
              progId
            ),
            transaction_type_id:
              MAP_TRANSACTION_TYPE[trx.program_id ?? 1][
                trx.transaction_type_id ?? 1
              ] ?? trx.transaction_type_id,
            transaction_reason_id:
              mapTrxReasonId[
                trx.discard?.reason_id ?? trx.transaction_reason_id ?? 0
              ] ?? null,
            other_reason: trx.other_reason ?? "",
            status_id: 1,
            entity_id: mapEntityId[trx.entity_id ?? 0],
            material_id: mapMaterialId[trx.material_id ?? 0],
            activity_id: mapActivityId[trx.activity_id ?? 0],
            customer_id: mapEntityId[trx.companion_entity_id ?? 0],
            stock_id: mapStockId[trx.stock_id ?? 0],
            change_qty: Math.abs(trx.change_qty ?? 0),
            broken_qty: trx.discard?.qty,
            is_batches: true,
            batch: {
              code: trx.batch_code ?? "",
              production_date: trx.batch_production_date
                ? trx.batch_production_date?.toString()
                : null,
              expired_date: trx.batch_expired_date?.toString() ?? "",
              manufacture_id: mapManufactureId[trx.manufacture_id ?? 0],
            },
            price: trx.purchase_price ?? undefined,
            source_material_id: mapBudgetSourceId[trx.budget_source_id ?? 0],
            year: trx.purchase_year ?? undefined,

            // rabies
            vaccine_sequence: MAP_RABIES_SEQUENCE[trx.vaccine_sequence_id ?? 1],
            preexposure_method: trx.rabies?.vaccine_method ?? null,
            transaction_patients: trx.rabies?.patients?.map((p) => ({
              identity_type: p.identity_type,
              patient_id: p.identity_number,
              phone_number: p.phone_number ?? undefined,
              vaccine_sequence: MAP_RABIES_SEQUENCE[p.vaccine_sequence],
              other_sequences: p.other_sequences?.map((s) => ({
                date: s.actual_transaction_date.toISOString(),
                sequence: MAP_RABIES_SEQUENCE[s.vaccine_sequence] ?? 1,
                method: trx.vaccine_method ?? 1,
              })),
            })),
          }))
      )

      const resp = await getSmile().postV2Transactions(req, {
        baseURL: SERVER_URL[progId],
        headers,
      })

      const trxMapping: Insertable<DB["mapping_transactions"]>[] = []
      const stockMapping: Insertable<DB["mapping_stocks"]>[] = []
      const batchMapping: Insertable<DB["mapping_batches"]>[] = []

      for (const [i, trxResp] of resp.data.data.entries()) {
        trxMapping.push({
          existing_transaction_id: trxResp.id,
          platform_transaction_id: payload[i]?.transaction_id ?? 0,
          program_id: progId,
        })

        if (trxResp.discard_id)
          trxMapping.push({
            existing_transaction_id: trxResp.discard_id,
            platform_transaction_id: payload[i]?.discard?.id ?? 0,
            program_id: progId,
          })

        if (trxResp.stock_id)
          stockMapping.push({
            existing_stock_id: trxResp.stock_id,
            platform_stock_id: payload[i]?.stock_id ?? 0,
            program_id: progId,
          })

        if (trxResp.batch_id)
          batchMapping.push({
            existing_batch_id: trxResp.batch_id,
            platform_batch_id: payload[i]?.batch_id ?? 0,
            program_id: progId,
          })
      }

      await Promise.all([
        insertMapping(c, "mapping_transactions", trxMapping),
        insertMapping(c, "mapping_stocks", stockMapping),
        insertMapping(c, "mapping_batches", batchMapping),
      ])

      console.log("Success Sync to 3.0")
    } catch (error) {
      await logError(c, error)
      if (error instanceof AxiosError) {
        console.log(error.response?.data)
      } else {
        console.log(error)
        throw new Error("An unknown error occurred")
      }
    }
  }
}
