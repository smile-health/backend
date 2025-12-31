import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import moment from "moment"
import { StockConsumptionRepository } from "./stock-consumption.repository.js"
import {
  DetailStockConsumptionDTO,
  DetailStockConsumptionResponse,
  GetDetailStockConsumptionQueries,
  GetListStockConsumptionQueries,
  ListStockConsumptionDTO,
  ListStockConsumptionResponse,
} from "./stock-consumption.schema.js"

export class StockConsumptionModule {
  constructor(private readonly repository: StockConsumptionRepository) {}

  #reconstructListStockConsumptionResponse(
    stockConsumption: ListStockConsumptionDTO[],
    param: GetListStockConsumptionQueries
  ) {
    const response = stockConsumption.reduce((result, item) => {
      const idxMaterial = result.findIndex(
        (val) => val.material.id === item.material_id
      )

      const material = {
        id: item.material_id,
        name: item.material_name,
        is_temperature_sensitive: item.is_temperature_sensitive,
        is_open_vial: item.is_open_vial,
        is_managed_in_batch: item.is_managed_in_batch,
        unit_of_consumption: item.unit_of_consumption,
        consumption_unit_per_distribution_unit:
          item.consumption_unit_per_distribution_unit,
      }

      const activity = {
        id: item.activity_id,
        name: item.activity_name,
      }

      const stockActivity = {
        id: item.stock_activity_id,
        name: item.stock_activity_name,
      }

      const stockConsumption = this.objStockConsumption(item, stockActivity)

      if (idxMaterial > -1) {
        const idxActivity = this.idxActivity(result, item, idxMaterial, param)

        const totalQtyPerMaterial =
          result[idxMaterial]!.total_qty + item.stock_qty
        result[idxMaterial]!.total_qty = totalQtyPerMaterial

        if (idxActivity > -1) {
          if (
            item.stock_activity_id ===
            result[idxMaterial]!.details[idxActivity]!.activity.id
          ) {
            const totalQtyPerActivity =
              result[idxMaterial]!.details[idxActivity]!.total_qty +
              item.stock_qty
            result[idxMaterial]!.details[idxActivity]!.total_qty =
              totalQtyPerActivity
          }

          result[idxMaterial]!.details[idxActivity]!.stock_consumptions.push(
            stockConsumption
          )
        } else {
          result[idxMaterial]!.details.push({
            activity,
            material,
            total_qty:
              item.stock_activity_id === item.activity_id ? item.stock_qty : 0,
            updated_at: moment(item.stock_updated_at).format(
              "YYYY-MM-DD HH:MM:ss"
            ),
            stock_consumptions: [stockConsumption],
          })
        }
      } else if (param.activity_id) {
        if (param.activity_id === item.activity_id) {
          result.push(this.resultObjStockConsumptionFilterActivty(item, stockConsumption, activity, material))
        }
      } else {
        result.push(this.resultObjStockConsumptionFilterActivty(item, stockConsumption, activity, material))
      }

      return result
    }, [] as ListStockConsumptionResponse[])

    return response
  }

  #reconstructDetailStockConsumptionResponse(
    stockConsumption: DetailStockConsumptionDTO[]
  ) {
    const response = stockConsumption.reduce((result, item) => {
      const material = {
        id: item.material_id,
        name: item.material_name,
        is_temperature_sensitive: item.is_temperature_sensitive,
        is_open_vial: item.is_open_vial,
        is_managed_in_batch: item.is_managed_in_batch,
        unit_of_consumption: item.unit_of_consumption,
        consumption_unit_per_distribution_unit:
          item.consumption_unit_per_distribution_unit,
      }

      const stockActivity = {
        id: item.stock_activity_id,
        name: item.stock_activity_name,
      }

      const stockConsumption = {
        id: item.stock_id,
        batch: item.batch_id
          ? {
              id: item.batch_id,
              code: item.batch_code,
              production_date: item.batch_production_date
                ? moment(item.batch_production_date).format(
                    "YYYY-MM-DD HH:MM:ss"
                  )
                : null,
              expired_date: item.batch_expired_date
                ? moment(item.batch_expired_date).format("YYYY-MM-DD HH:MM:ss")
                : null,
              manufacture: item.manufacture_id
                ? {
                    id: item.manufacture_id,
                    name: item.manufacture_name,
                    address: item.manufacture_address,
                  }
                : null,
            }
          : null,
        qty: item.stock_qty,
        updated_at: moment(item.stock_updated_at).format("YYYY-MM-DD HH:MM:ss"),
        activity: stockActivity,
      }

      const idxActivity = result.findIndex(
        (val) =>
          val.material.id === item.material_id &&
          val.activity.id === item.stock_activity_id
      )

      if (idxActivity > -1) {
        const totalQtyPerActivity =
          result[idxActivity]!.total_qty + item.stock_qty
        result[idxActivity]!.total_qty = totalQtyPerActivity

        result[idxActivity]!.stock_consumptions.push(stockConsumption)
      } else {
        result.push({
          activity: stockActivity,
          material,
          total_qty: item.stock_qty,
          updated_at: moment(item.stock_updated_at).format(
            "YYYY-MM-DD HH:MM:ss"
          ),
          stock_consumptions: [stockConsumption],
        })
      }

      return result
    }, [] as DetailStockConsumptionResponse[])

    return response
  }

  async list(c: Context, param: GetListStockConsumptionQueries) {
    const { list, total } = await this.repository.getListStockMaterial(
      c,
      param,
      c.var.programId
    )

    const listResponse = this.#reconstructListStockConsumptionResponse(
      list,
      param
    )
    return new PaginatedResponse(param, listResponse, total)
  }

  async detail(c: Context, param: GetDetailStockConsumptionQueries) {
    const detail = await this.repository.getDetailStockMaterial(
      c,
      param,
      c.var.programId
    )

    const detailResponse =
      this.#reconstructDetailStockConsumptionResponse(detail)
    return { details: detailResponse }
  }

  private readonly objStockConsumption = (item: ListStockConsumptionDTO, stockActivity: { id: number, name: string }) => {
    return {
      id: item.stock_id,
      batch: item.batch_id
        ? {
            id: item.batch_id,
            code: item.batch_code,
            production_date: item.batch_production_date
              ? moment(item.batch_production_date).format(
                  "YYYY-MM-DD HH:MM:ss"
                )
              : null,
            expired_date: item.batch_expired_date
              ? moment(item.batch_expired_date).format("YYYY-MM-DD HH:MM:ss")
              : null,
            manufacture: item.manufacture_id
              ? {
                  id: item.manufacture_id,
                  name: item.manufacture_name,
                  address: item.manufacture_address,
                }
              : null,
          }
        : null,
      qty: item.stock_qty,
      updated_at: moment(item.stock_updated_at).format("YYYY-MM-DD HH:MM:ss"),
      activity: stockActivity,
    }
  }

  private readonly resultObjStockConsumptionFilterActivty = (item: ListStockConsumptionDTO, stockConsumption: any, activity: any, material: any) => {
    return {
      total_qty: item.stock_qty,
      updated_at: moment(item.stock_updated_at).format(
        "YYYY-MM-DD HH:MM:ss"
      ),
      entity: {
        id: item.entity_id,
        name: item.entity_name,
        type: item.entity_type,
        address: item.entity_address,
        tag: item.entity_tag,
        location: item.location,
      },
      material,
      details: [
        {
          activity,
          material,
          total_qty:
            item.stock_activity_id === item.activity_id
              ? item.stock_qty
              : 0,
          updated_at: moment(item.stock_updated_at).format(
            "YYYY-MM-DD HH:MM:ss"
          ),
          stock_consumptions: [stockConsumption],
        },
      ],
    }
  }

  private readonly idxActivity = (result: ListStockConsumptionResponse[], item: ListStockConsumptionDTO, idxMaterial: number, param: GetListStockConsumptionQueries) => {
    return result[idxMaterial]!.details.findIndex((val) => {
      if (param.activity_id) {
        return (
          val.material.id === item.material_id &&
          val.activity.id === param.activity_id
        )
      }

      return (
        val.material.id === item.material_id &&
        val.activity.id === item.activity_id
      )
    })
  }
}
