import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AssetMonitoringDeviceModule } from "./asset-monitoring-device.module.js"
import {
    AssetMonitoringDeviceQueryParams,
    AssetMonitoringDeviceQueryParamsSchema,
} from "./asset-monitoring-device.schema.js"

export class AssetMonitoringDeviceController extends BaseController {
    constructor(
        private readonly module: AssetMonitoringDeviceModule,
        private readonly roleMiddleware: RoleMiddleware
    ) {
        super("asset_monitoring_device")
    }

    getRoutes(): Hono {
        const router = new Hono()

        router.use(
            this.roleMiddleware.allowWithDeviceType([
                [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
                [USER_ROLE.ADMIN, DEVICE_TYPE.web],
                [USER_ROLE.MANAGER, DEVICE_TYPE.web],
                [USER_ROLE.SATUSEHAT, DEVICE_TYPE.web],
            ])
        )

        router.get(
            "/coldstorage",
            this.validateRequest("query", AssetMonitoringDeviceQueryParamsSchema),
            async (c) => {
                const queryParams = c.req.valid(
                    "query"
                ) as AssetMonitoringDeviceQueryParams
                const response = await this.module.getColdstorageDashboard(
                    c,
                    queryParams
                )
                return c.json(response, StatusCodes.OK)
            }
        )

        router.get(
            "/excursion",
            this.validateRequest("query", AssetMonitoringDeviceQueryParamsSchema),
            async (c) => {
                const queryParams = c.req.valid(
                    "query"
                ) as AssetMonitoringDeviceQueryParams
                const response = await this.module.getExcursionDashboard(c, queryParams)
                return c.json(response, StatusCodes.OK)
            }
        )

        router.get(
            "/export",
            this.validateRequest("query", AssetMonitoringDeviceQueryParamsSchema),
            async (c) => {
                const queryParams = c.req.valid(
                    "query"
                ) as AssetMonitoringDeviceQueryParams
                const file = await this.module.exportTempStatus(c, queryParams)
                return this.downloadExcel(c, file)
            }
        )

        return router
    }
}
