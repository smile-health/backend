import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import moment from "moment"

export class LoggerHistoryRepository {
  private formatDate = 'YYYY-MM-DD HH:mm:ss'

  async findAssetBySerialNumber(c: Context, serialNumber: string) {
    return await c.var.trx
      .selectFrom("ws_asset_inventories")
      .selectAll()
      .where("serial_number", "=", serialNumber)
      .executeTakeFirst()
  }

  async createHistory(c: Context, historyData: any) {
    return await c.var.trx
      .insertInto("ws_logger_histories")
      .values(historyData)
      .executeTakeFirst()
  }

  // Note: Asset update methods removed since ws_asset_inventories doesn't have 
  // the logger-specific fields (temp, status_device, battery, signal, power)

  formatActualDate(actualDate?: string): string {
    if (actualDate) {
      return moment(actualDate).format(this.formatDate)
    }
    return moment().format(this.formatDate)
  }
}