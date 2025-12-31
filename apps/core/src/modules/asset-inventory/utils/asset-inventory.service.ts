import { AssetInventoryNotification } from "@/modules/asset-inventory/utils/asset-inventory.notification.js"
import { AssetInventoryRepository } from "@/modules/asset-inventory/asset-inventory.repository.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { getConnection } from "@/common/infrastructure/mq/index.js"
import { TransactionManager } from "@smile/lib/database.js"
import { db } from "@/common/infrastructure/database/index.js"
import i18n from "@smile/lib/i18n.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { Context } from "hono"
import { NotificationTypeRepository } from "@/common/repository/notification-type"

export class AssetInventoryService {
  private assetNotif: AssetInventoryNotification

  constructor() {
    this.assetNotif = new AssetInventoryNotification(
      new AssetInventoryRepository(),
      new UserRepository(),
      new Publisher(getConnection),
      new NotificationTypeRepository()
    )
  }

  private createFakeContext(): Context {
    return {
      req: {
        header: () => undefined,
        query: () => "",
        param: () => "",
        json: async () => ({}),
        text: async () => "",
      },
      res: {} as unknown,
      env: {},
      get: () => undefined,
      set: () => {},
      var: {},
    } as unknown as Context
  }

  async sendMaintenanceReminder(apiContext?: Context): Promise<unknown> {
    return await new TransactionManager(db).transaction(async (trx) => {
      const translator = i18n.cloneInstance()
      translator.changeLanguage("id")
      const customContext = new CustomContext({
        trx,
        t: translator.t,
        "feature-flags": () => false,
        "feature-enabled": () => false,
      })
      const context = apiContext || this.createFakeContext()

      return await this.assetNotif.handleAssetMaintenanceReminder(
        customContext,
        context
      )
    })
  }

  async sendCalibrationReminder(apiContext?: Context): Promise<unknown> {
    return await new TransactionManager(db).transaction(async (trx) => {
      const translator = i18n.cloneInstance()
      translator.changeLanguage("id")
      const customContext = new CustomContext({
        trx,
        t: translator.t,
        "feature-flags": () => false,
        "feature-enabled": () => false,
      })
      const context = apiContext || this.createFakeContext()

      return await this.assetNotif.handleAssetCalibrationReminder(
        customContext,
        context
      )
    })
  }

  async sendWarrantyReminder(apiContext?: Context): Promise<unknown> {
    return await new TransactionManager(db).transaction(async (trx) => {
      const translator = i18n.cloneInstance()
      translator.changeLanguage("id")
      const customContext = new CustomContext({
        trx,
        t: translator.t,
        "feature-flags": () => false,
        "feature-enabled": () => false,
      })
      const context = apiContext || this.createFakeContext()

      return await this.assetNotif.handleAssetWarrantyReminder(
        customContext,
        context
      )
    })
  }

  async sendStatusChangedNotification(
    apiContext: Context,
    assetId: number
  ): Promise<unknown> {
    return await new TransactionManager(db).transaction(async (trx) => {
      const translator = i18n.cloneInstance()
      translator.changeLanguage("id")
      const customContext = new CustomContext({
        trx,
        t: translator.t,
        "feature-flags": () => false,
        "feature-enabled": () => false,
      })
      const context = apiContext || this.createFakeContext()
      return await this.assetNotif.handleAssetChangedNotification(
        customContext,
        context,
        assetId
      )
    })
  }
}
