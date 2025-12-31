import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { BaseController } from "@smile/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { AppMobileDataModule } from "./app-mobile-data.module.js"

export class AppMobileDataController extends BaseController {
  constructor(
    private readonly appMobileDataModule: AppMobileDataModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("app-mobile-data")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/cva",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp =
          await this.appMobileDataModule.listCustomerVendorActivity(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/trx-types",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp =
          await this.appMobileDataModule.listTransactionTypeReasonByWorkspace(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/materials",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp = await this.appMobileDataModule.listMaterialEntityStock(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/materials/activities",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp = await this.appMobileDataModule.listMaterialActivities(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/materials/activity-consumptions",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp =
          await this.appMobileDataModule.listMaterialActivityConsumptions(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/materials/manufactures",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp = await this.appMobileDataModule.listMaterialManufactures(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/materials/companions",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp = await this.appMobileDataModule.listMaterialCompanions(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/materials/material_hierarchy",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp = await this.appMobileDataModule.listMaterialHierarchy(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/materials/stocks",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp = await this.appMobileDataModule.listMaterialStocks(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/cv-relocation",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp = await this.appMobileDataModule.listCvRelocation(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    router.get(
      "/notif",
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ]),
      async (c) => {
        const resp = await this.appMobileDataModule.listAppNotif(c)
        return c.json(resp, StatusCodes.OK)
      }
    )

    return router
  }
}
