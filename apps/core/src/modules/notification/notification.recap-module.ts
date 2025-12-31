import { notificationDb, db } from "@/common/infrastructure/database"
import { sql } from "kysely"
import i18n from "@smile/lib/i18n.js"
import {
  USER_ROLE,
  USER_STATUS,
  DAILY_RECAP_EMAIL,
} from "@/common/constants/users"
import { ENTITY_TYPE } from "@/common/constants/entity"

import moment from "moment"
import { TranslationModule } from "@/common/modules/translation.module"
import { CustomContext } from "@smile/lib/types/context"
import { Mailer } from "@smile/lib/mail/mail"
import { Context } from "hono"

type VendorRow = {
  vendor_id: number
  user_id: number
  email: string
  customer_id: number | null
  customer2_id: number | null
}

type VendorResult = {
  vendor_id: number
  users: { id: number; email: string }[]
  customers: number[]
}

function mapVendors(rows: VendorRow[]): VendorResult[] {
  const map = new Map<number, VendorResult>()

  for (const row of rows) {
    let vendor = map.get(row.vendor_id)

    if (!vendor) {
      vendor = {
        vendor_id: row.vendor_id,
        users: [],
        customers: [],
      }
      map.set(row.vendor_id, vendor)
    }

    if (row.user_id && !vendor.users.some((u) => u.id === row.user_id)) {
      vendor.users.push({ id: row.user_id, email: row.email })
    }

    if (row.customer_id && !vendor.customers.includes(row.customer_id)) {
      vendor.customers.push(row.customer_id)
    }
    if (row.customer2_id && !vendor.customers.includes(row.customer2_id)) {
      vendor.customers.push(row.customer2_id)
    }
  }

  return Array.from(map.values())
}

function emailTemplateHTML(
  c: Context,
  sections: {
    section: string
    sorter: number
    types: string[]
  }[] = [],
  notifications: {
    message: string | null
    type: string
    event_code: string | null
    entity_ids: number[]
    created_at: Date
  }[] = []
) {
  const transl = new TranslationModule()
  const date = moment().format("DD/MM/YY")

  let listContent = ``
  for (const section of sections) {
    const sectionNotifications = notifications.filter((notif) =>
      section.types.includes(notif.type)
    )
    if (sectionNotifications.length === 0) {
      continue
    }
    listContent += `
    <div class="section">
      <h2 class="section-title">${transl.setMessage(c, section?.section)}</h2>
      <table style="width:100%" class="event-item">`
    for (const notif of sectionNotifications) {
      listContent += `
        <tr>
          <td>${moment(notif?.created_at).tz("Asia/Jakarta").format("DD/MM/YYYY HH:mm:ss")} - ${transl.setMessage(c, notif?.message ?? "")}</td>
        </tr>`
    }

    listContent += `
      </table>
    </div>
    `
  }
  const content = `
  <!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Events Report - SMILE</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
        background-color: #9e9e9e;
      }
      table,
      th,
      td {
        border-collapse: collapse;
        padding: 12px 15px;
        color: #0C3045;
        border: 1px #D4D4D4 solid;
        background-color: #E2F3FC;
        font-size: 16px;
      }
 
      .email-container {
        max-width: 900px;
        margin: 0 auto;
        background-color: #ffffff;
      }
 
      .header {
        background: #E2F3FC;
        padding: 40px 50px;
        text-align: center;
      }
 
      .logo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
 
      .logo-image {
        width: 126px;
      }
 
      .content {
        padding: 40px 50px;
        background-color: #ffffff;
      }
 
      .main-title {
        font-size: 30px;
        font-weight: 600;
        color: #0C3045;
        margin: 0 0 40px 0;
      }
 
      .section {
        margin-bottom: 40px;
      }
 
      .section-title {
        font-size: 20px;
        font-weight: 600;
        color: #0C3045;
        margin: 0 0 15px 0;
        padding-bottom: 8px;
        border-bottom: 1px solid #bdc3c7;
      }
 
      .empty-section {
        height: 40px;
        background-color: #F5F5F4;
      }
 
      .footer {
        background-color: #ffffff;
        padding: 30px 50px;
        text-align: center;
        color: #073B4C;
        font-size: 16px;
        font-weight: 400;
      }
 
      @media only screen and (max-width: 600px) {
        .email-container {
          border: none;
          margin: 0;
        }
 
        .header,
        .content,
        .footer {
          padding: 20px;
        }
 
        .main-title {
          font-size: 24px;
        }
 
        .section-title {
          font-size: 18px;
        }
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <!-- Header -->
      <div class="header">
        <div class="logo">
          <img class="logo-image" alt="logo" src="https://smile.kemkes.go.id/images/logo-smile.svg">
        </div>
      </div>
      <!-- Content -->
      <div class="content">
        <h1 class="main-title">Events on ${date}</h1>
        <!-- Content List Notifications -->
        ${listContent}
      </div>
      <!-- Footer -->
      <div class="footer"> © 2025 SMILE | UNDP </div>
    </div>
  </body>
</html>
  `
  return content
}

async function getNotifications(notificationTypes = []) {
  const start = moment().subtract(1, "day").toDate()
  const end = moment().toDate()
  const notifications = await notificationDb
    .selectFrom("notifications")
    .select(["message", "type", "event_code"])
    .select(sql<Array<number>>`JSON_ARRAYAGG(entity_id)`.as("entity_ids"))
    .select(sql<Date>`MAX(created_at)`.as("created_at"))
    .where("created_at", ">", start)
    .where("created_at", "<", end)
    .where("event_code", "is not", null)
    .where("type", "in", notificationTypes)
    .groupBy("event_code")
    .orderBy(
      sql`FIELD(JSON_EXTRACT(SUBSTRING(message, LOCATE(', ', message) + 2), '$.material_type_id'), 2, 1, 4, 3, 5)`
    )
    .orderBy("created_at", "desc")
    .execute()

  return notifications
}

async function getRecapNotifSections(c) {
  const notificationRecaps = await c.var.trx
    .selectFrom("notification_recaps as nr")
    .select(["nr.section", "nr.sorter"])
    .select(sql<string>`JSON_ARRAYAGG(nt.type)`.as("types"))
    .innerJoin("notification_types as nt", "nt.id", "nr.notification_type_id")
    .groupBy("nr.section")
    .orderBy("sorter", "asc")
    .execute()

  return notificationRecaps
}

async function sendNotifToUser({
  users = [],
  content = "",
}: {
  users: { id: number; email: string | null }[]
  content: string
}) {
  const subject = "[SMILE] Daily Notification Recap"
  const validUsers = users.filter((u) => u.email)
  const transport = new Mailer()
  await Promise.all(
    validUsers.map(async (u) => {
      try {
        await transport.sendMail(u.email!, subject, content)
      } catch (error) {
        console.error("Failed to send notif to user:", error)
      }
    })
  )
}

async function sendToSuperAdmin(
  c,
  sections: {
    section: string
    sorter: number
    types: string[]
  }[],
  notifications: {
    message: string | null
    type: string
    event_code: string | null
    entity_ids: number[]
    created_at: Date
  }[]
) {
  const superAdmins = await c.var.trx
    .selectFrom("users")
    .select(["id", "email"])
    .where("role", "=", USER_ROLE.SUPERADMIN)
    .where("status", "=", USER_STATUS.ACTIVE)
    .where("daily_recap_email", "=", DAILY_RECAP_EMAIL.YES)
    .execute()

  const content = emailTemplateHTML(c, sections, notifications)

  await sendNotifToUser({ users: superAdmins, content })
}

async function sendToVendor(
  c,
  sections: {
    section: string
    sorter: number
    types: string[]
  }[],
  notifications: {
    message: string | null
    type: string
    event_code: string | null
    entity_ids: number[]
    created_at: Date
  }[]
) {
  const vendors = await c.var.trx
    .selectFrom("ws_entities as we")
    .innerJoin("ws_users as wu", "wu.entity_id", "we.id")
    .innerJoin("users as u", "u.id", "wu.global_id")
    .innerJoin("ws_customer_vendors as wcv", "wcv.vendor_id", "we.global_id")
    .innerJoin("ws_entities as cust1", "cust1.global_id", "wcv.customer_id")
    .leftJoin(
      "ws_customer_vendors as wcv2",
      "wcv2.vendor_id",
      "cust1.global_id"
    )
    .leftJoin("ws_entities as cust2", (join) =>
      join
        .onRef("cust2.global_id", "=", "wcv2.customer_id")
        .on("cust2.type", "=", ENTITY_TYPE.HEALTH_FACILITY)
    )
    .select([
      "u.id as user_id",
      "u.email as email",
      "we.id as vendor_id",
      "cust1.id as customer_id",
      "cust2.id as customer2_id",
    ])
    .where("we.type", "in", [ENTITY_TYPE.PROVINCE, ENTITY_TYPE.CITY])
    .where("u.daily_recap_email", "=", DAILY_RECAP_EMAIL.YES)
    .where("u.status", "=", USER_STATUS.ACTIVE)
    .where("u.role", "in", [USER_ROLE.MANAGER])
    .where("we.program_id", "=", 1)
    .execute()

  const usersVendor = mapVendors(vendors)

  for (const vendor of usersVendor) {
    const vendorNotifications = notifications.filter((notif) => {
      const entityIds = notif.entity_ids ? notif.entity_ids : []
      return entityIds.some(
        (id) => vendor.customers.includes(id) || vendor.vendor_id === id
      )
    })

    if (vendorNotifications.length === 0) {
      continue
    }

    const content = emailTemplateHTML(c, sections, vendorNotifications)

    await sendNotifToUser({ users: vendor.users, content })
  }
}

export async function sendingRecapNotif() {
  console.log("Starting recap email process...")
  return await db.transaction().execute(async (trx) => {
    const newi18n = i18n.cloneInstance()
    newi18n.changeLanguage("id")
    const c = new CustomContext({
      trx,
      t: newi18n.t,
      "feature-enabled": () => false,
      "feature-flags": () => false,
    })
    const sections = await getRecapNotifSections(c)
    const notifications = await getNotifications(
      sections.map((i) => i.types).flat()
    )

    if (notifications.length === 0) {
      console.log("No notifications found for the past day. Exiting process.")
      return { message: "No notifications found for the past day." }
    }
    await sendToSuperAdmin(c, sections, notifications)
    await sendToVendor(c, sections, notifications)
    console.log("Recap email process completed.")

    return { message: "Recap email process completed" }
  })
}
