import { DB } from "@/common/infrastructure/database/types/db.js"
import { AuthKeycloakMiddleware } from "@/common/middlewares/auth.middleware.js"
import { AssetModelModule } from "@/modules/asset-model/asset-model.module.js"
import { AssetMonitoringDeviceModule } from "@/modules/asset-monitoring-device/asset-monitoring-device.module.js"
import { AssetMonitoringTemperatureModule } from "@/modules/asset-monitoring-temperature/asset-monitoring-temperature.module.js"
import { AssetTypeModule } from "@/modules/asset-type/asset-type.module.js"
import { OpenAPIHono } from "@hono/zod-openapi"
import { RequestMiddleware } from "@smile/lib/middlewares/request.middleware.js"
import { TransactionMiddleware } from "@smile/lib/middlewares/transaction.middleware.js"
import { StatusCodes } from "http-status-codes"
import { IotModule } from "./iot.module.js"
import {
  iotGetAssetModelRoute,
  iotGetAssetsRoute,
  iotGetAssetTypeRoute,
  iotPostAssetsRoute,
  iotPushHistoriesRoute,
  iotWarehousePushHistoriesRoute,
} from "./iot.routes.js"

export class IotController {
  constructor(
    private readonly module: IotModule,
    private readonly pushLoggerModule: AssetMonitoringTemperatureModule,
    private readonly reqMiddleware: RequestMiddleware,
    private readonly trxMiddleware: TransactionMiddleware<DB>,
    private readonly authMiddleware: AuthKeycloakMiddleware
  ) { }

  registerRoutes(app: OpenAPIHono) {
    const middlewares = [
      this.reqMiddleware.handle,
      this.trxMiddleware.handle,
      this.authMiddleware.handleAuthKeycloak,
    ]

    app.use(iotPushHistoriesRoute.getRoutingPath(), ...middlewares)
    app.openapi(iotPushHistoriesRoute, async (c) => {
      const body = c.req.valid("json")
      const parsedBody = body.map((item) => ({
        ...item,
        curr_temp: Number(item.curr_temp),
        lat: Number(item.lat),
        lon: Number(item.lon),
      }))
      const result = await this.pushLoggerModule.pushTemperatureHistory(c, parsedBody)
      return c.json({ data: result, message: "Finish" }, StatusCodes.OK)
    })

    app.use(iotWarehousePushHistoriesRoute.getRoutingPath(), ...middlewares)
    app.openapi(iotWarehousePushHistoriesRoute, async (c) => {
      const body = c.req.valid("json")
      const parsedBody = body.map((item) => ({
        ...item,
        curr_temp: Number(item.curr_temp),
        lat: Number(item.lat),
        lon: Number(item.lon),
        battery: item.battery ?? 0,
        signal: item.signal ?? 0,
        power: item.power,
      }))
      const result = await this.pushLoggerModule.pushTemperatureHistory(c, parsedBody)
      return c.json({ data: result, message: "Finish" }, StatusCodes.OK)
    })

    app.use(iotPostAssetsRoute.getRoutingPath(), ...middlewares)
    app.openapi(iotPostAssetsRoute, async (c) => {
      const body = c.req.valid("json")
      const resp = await this.module.createAsset(c, body)
      return c.json(resp, StatusCodes.OK)
    })

    app.use(iotGetAssetTypeRoute.getRoutingPath(), ...middlewares)
    app.openapi(iotGetAssetTypeRoute, async (c) => {
      const query = c.req.valid("query")
      const resp = await this.module.getAssetTypes(c, query)
      return c.json(resp)
    })

    app.use(iotGetAssetModelRoute.getRoutingPath(), ...middlewares)
    app.openapi(iotGetAssetModelRoute, async (c) => {
      const query = c.req.valid("query")
      const resp = await this.module.getAssetModels(c, query)
      return c.json(resp)
    })

    app.use(iotGetAssetsRoute.getRoutingPath(), ...middlewares)
    app.openapi(iotGetAssetsRoute, async (c) => {
      const query = c.req.valid("query")
      const resp = await this.module.getAssets(c, query)
      return c.json(resp)
    })
  }
}
