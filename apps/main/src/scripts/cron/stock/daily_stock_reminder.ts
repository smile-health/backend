import { db } from "@/common/infrastructure/database/index.js"
import { getConnection } from "@/common/infrastructure/mq/index.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"
import { EntityCustomerRepository } from "@/modules/entity-customer/entity-customer.repository.js"
import { StockCron } from "@/modules/stock/stock.cron.js"
import { StockRepository } from "@/modules/stock/stock.repository.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { TransactionManager } from "@smile-health/lib/database.js"
import i18n from "@smile-health/lib/i18n.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { Context } from "hono"

export const dailyStockReminder = async (context: Context) => {
  const stockCron = new StockCron(
    new StockRepository(),
    new UserRepository(),
    new EntityCustomerRepository(),
    new NotificationTypeRepository(),
    new Publisher(getConnection)
  )

  await new TransactionManager(db).transaction(async (trx) => {
    const translator = i18n.cloneInstance()
    translator.changeLanguage("id")
    const c = new CustomContext({
      trx,
      t: translator.t,
      "feature-enabled": () => false,
      "feature-flags": () => false,
    })

    await stockCron.handleNotifStock(c, context, c.var.t)
    process.exit(0)
  })
}
