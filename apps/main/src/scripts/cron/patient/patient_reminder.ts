import { db } from "@/common/infrastructure/database/index.js"
import { getConnection } from "@/common/infrastructure/mq/index.js"
import { NotificationTypeRepository } from "@/common/repository/notification-type.js"
import { PatientCron } from "@/modules/transaction/patient/patient.cron.js"
import { PatientRepository } from "@/modules/transaction/patient/patient.repository.js"
import { UserRepository } from "@/modules/user/user.repository.js"
import { TransactionManager } from "@smile/lib/database.js"
import i18n from "@smile/lib/i18n.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { CustomContext } from "@smile/lib/types/context.js"
import { Context } from "hono"

export const patientReminder = async (context: Context) => {
  const cron = new PatientCron(
    new PatientRepository(),
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
      "feature-flags": () => false,
      "feature-enabled": () => false,
    })
    await cron.handleReminderNotif(c, context, c.var.t)
    process.exit(0)
  })
}
