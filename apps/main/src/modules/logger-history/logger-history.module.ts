import { Context } from "hono"
import { LoggerHistoryRepository } from "./logger-history.repository.js"
import { PushLoggerHistoryDTO, PushSingleLoggerHistoryDTO } from "./logger-history.schema.js"
import moment from "moment"

export class LoggerHistoryModule {
  private loggerHistoryRepo: LoggerHistoryRepository

  constructor(loggerHistoryRepo: LoggerHistoryRepository) {
    this.loggerHistoryRepo = loggerHistoryRepo
  }

  async pushHistoryData(c: Context, newData: PushLoggerHistoryDTO) {
    const processedData = []

    for (let item of newData) {
      const processedItem = { ...item, message: '', result: '' }

      let {
        device_id,
        lat,
        lon,
        curr_temp,
        actual_date,
        status_device,
        battery,
        signal,
        power,
        humidity,
      } = item

      const formattedActualDate = this.loggerHistoryRepo.formatActualDate(actual_date)

      if (!device_id) {
        processedItem.message = 'device id cannot be null'
        processedItem.result = 'Failed'
        processedData.push(processedItem)
        continue
      }

      // Check for duplicate data in the same batch
      if (
        newData.filter(
          (it) =>
            it.device_id == device_id &&
            processedData.find(p => p.result === 'Ok') &&
            moment(it.actual_date).format('YYYY-MM-DD HH:mm:ss') == formattedActualDate
        ).length > 0
      ) {
        processedItem.message = 'same data as the others'
        processedItem.result = 'Failed'
        processedData.push(processedItem)
        continue
      }

      const asset = await this.loggerHistoryRepo.findAssetBySerialNumber(c, device_id)
      if (!asset) {
        processedItem.message = 'device not registered'
        processedItem.result = 'Failed'
        processedData.push(processedItem)
        continue
      }

      // Note: In the v2 implementation, asset fields like temp, status_device, battery, signal, power
      // were updated, but in this main app, the ws_asset_inventories table doesn't have these fields.
      // We only create the history record as the primary functionality.

      // Create history record
      const newHistory: any = {
        device_code: device_id,
        temp: curr_temp,
        status: 1,
        lat: lat,
        long: lon,
        asset_id: asset.id,
        entity_id: asset.entity_id,
        actual_date: formattedActualDate,
        status_device,
        battery,
        signal,
        power,
        working_status: null, // Simplified - no parent asset relationships
        max_temp: null, // Simplified - no min/max temp logic
        min_temp: null, // Simplified - no min/max temp logic
        logger_status: null, // Simplified - no logger status field in asset
        humidity: humidity || null,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const result = await this.loggerHistoryRepo.createHistory(c, newHistory)

      if (result) {
        processedItem.message = 'Success inserted'
        processedItem.result = 'Ok'

        // TODO: Implement notification sending similar to v2
        // const data = { newHistory: result, version: 2, asset }
        // sendNotif(data)
      } else {
        processedItem.message = 'Error'
        processedItem.result = 'Failed'
      }

      processedData.push(processedItem)
    }

    return {
      data: processedData,
      message: 'Finish',
    }
  }

  async pushSingleHistory(c: Context, body: PushSingleLoggerHistoryDTO) {
    if (!body.device_id) {
      throw new Error('device id cannot be null')
    }

    const asset = await this.loggerHistoryRepo.findAssetBySerialNumber(c, body.device_id)
    if (!asset) {
      throw new Error('device not registered')
    }

    const formattedActualDate = this.loggerHistoryRepo.formatActualDate(body.actual_date)

    // Create history record (simplified - no asset update since fields don't exist in ws_asset_inventories)
    const newHistory = {
      device_code: body.device_id,
      temp: body.curr_temp,
      status: 0,
      lat: body.lat,
      long: body.lng,
      asset_id: asset.id,
      entity_id: asset.entity_id,
      status_device: body.status_device,
      battery: body.battery,
      signal: body.signal,
      power: body.power,
      actual_date: formattedActualDate,
      working_status: null, // Simplified - no parent asset relationships
      max_temp: null, // Simplified - no min/max temp logic
      min_temp: null, // Simplified - no min/max temp logic
      logger_status: null, // Simplified - no logger status field in asset
      humidity: null, // Not provided in single push
      created_at: new Date(),
      updated_at: new Date(),
    }

    await this.loggerHistoryRepo.createHistory(c, newHistory)

    const result = { message: 'Success' }

    return result
  }
}