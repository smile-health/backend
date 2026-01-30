import { db } from "@/common/infrastructure/database/index.js"
import { getConnection } from "@/common/infrastructure/mq/index.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"
import { EntityCron } from "@/modules/entity/entity.cron.js"
import { EntityRepository } from "@/modules/entity/entity.repository.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { TransactionManager } from "@smile-health/lib/database.js"
import i18n from "@smile-health/lib/i18n.js"
import { Publisher } from "@smile-health/lib/rabbitmq/publisher.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { Context } from "hono"

export const inactiveEntityReminder = async (context: Context) => {
  const entityCron = new EntityCron(
    new EntityRepository(),
    new UserRepository(),
    new Publisher(getConnection),
    new NotificationTypeRepository()
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

    await entityCron.handleInactiveEntityNotif(c, context, c.var.t)
    process.exit(0)
  })
}
