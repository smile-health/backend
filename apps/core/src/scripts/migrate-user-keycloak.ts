import { db } from "@/common/infrastructure/database/index.js"
import { UserTemplateXlsx } from "@/modules/user/user.excel.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import fs from "fs"
import { sql } from "kysely"
import moment from "moment"
import path from "path"

export const migrateUserKeycloak = async () => {
  console.log("--------migration start--------")
  const timeStart = process.hrtime()

  const stream = db
    .selectFrom("users as u")
    .innerJoin("user_workspaces as uw", "uw.user_id", "u.id")
    .select([
      "u.username",
      "u.role",
      "u.view_only",
      "u.firstname",
      "u.lastname",
      "u.email",
      "u.gender",
      "u.address",
      "u.village_id",
      "u.date_of_birth",
      "u.mobile_phone",
      "u.entity_id",
      sql<string>`GROUP_CONCAT(uw.workspace_id SEPARATOR '|')`.as("program_id"),
      "u.manufacture_id",
    ])
    .groupBy("u.id")
    .where("u.gender", "is not", null)
    .where("u.email", "is not", null)
    .stream()

  // Consturct rows excel
  const rows: (string | number | Date | null)[][] = []
  const filteredRows: (string | number | Date | null)[][] = []

  for await (const item of stream) {
    let phoneNumber = item.mobile_phone
    if (phoneNumber?.startsWith("0")) {
      phoneNumber = "+62" + phoneNumber.substring(1)
    }
    const email = item.email?.trim()
    const isValid = email && RegExp(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).exec(email)

    if (isValid) {
      const row = [
        item.username,
        item.role,
        item.view_only === 1 ? "YES" : "NO",
        item.firstname,
        item.lastname,
        email,
        item.gender,
        "Smile123*",
        item.address,
        item.village_id,
        item.date_of_birth,
        phoneNumber,
        item.entity_id,
        item.program_id,
        item.manufacture_id,
      ]
      rows.push(row)
    }
  }

  // Loop through rows and validate if the email already exists
  const uniqueEmails = new Set()
  for (const row of rows) {
    const email = row[5]
    if (email && !uniqueEmails.has(email)) {
      // check if email is in correctformat
      uniqueEmails.add(email)
      filteredRows.push(row)
    }
  }

  // Consturct columns excel
  const columns = [
    {
      key: "username",
      header: "Username",
      width: 20,
    },
    {
      key: "role",
      header: "ID Role",
      width: 10,
    },
    {
      key: "view_only",
      header: "View Only",
      width: 10,
    },
    {
      key: "firstname",
      header: "Firstname",
      width: 20,
    },
    {
      key: "lastname",
      header: "Lastname",
      width: 20,
    },
    {
      key: "email",
      header: "Email",
      width: 25,
    },
    {
      key: "gender",
      header: "ID Gender",
      width: 10,
    },
    {
      key: "password",
      header: "Password",
      width: 25,
    },
    {
      key: "address",
      header: "Address",
      width: 35,
    },
    {
      key: "village_id",
      header: "ID Village",
      width: 10,
    },
    {
      key: "date_of_birth",
      header: "Birth Date",
      width: 10,
    },
    {
      key: "mobile_phone",
      header: "Mobile Phone",
      width: 15,
    },
    {
      key: "entity_id",
      header: "ID Entity",
      width: 10,
    },
    {
      key: "program_id",
      header: "ID Program",
      width: 15,
    },
    {
      key: "manufacture_id",
      header: "ID Manufacture",
      width: 15,
    },
  ]

  // Create Excel File
  const sheet = "DATA ENTRY"
  const excelTemplate = new UserTemplateXlsx(PROCESSOR.SHEETJS)
  await excelTemplate.initSheet(sheet)

  excelTemplate.setTitle("Users")
  excelTemplate.setColumns(columns, "A9")
  await excelTemplate.addRows(sheet, filteredRows, 10)

  fs.mkdirSync(path.resolve(__dirname, `../scripts/output`), {
    recursive: true,
  })

  const pathname = path.resolve(
    __dirname,
    `../scripts/output/migration_users_keycloak${moment().format("DD-MM-YYYY HH_mm_ss")}.xlsx`
  )

  excelTemplate.writeFile(pathname)
  const timeDiff = process.hrtime(timeStart)
  const timeTaken = Math.round((timeDiff[0] * 1e9 + timeDiff[1]) / 1e6)
  console.log("Time Taken ======>", `${timeTaken}ms`)

  console.log("--------migration end--------")
}
