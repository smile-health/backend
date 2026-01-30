import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const users = [
    {
      id: 1626,
      username: "arya",
      password: "$2a$10$/OFlvvk7u.ROyBFQUylqcuCB.1txO9qK09zjwSrnEdmV52XRuzpOK",
      email: "arya@smile.co.id",
      firstname: "Arya",
      lastname: "IT",
      date_of_birth: null,
      gender: 1,
      mobile_phone: null,
      address: null,
      role: 1,
      village_id: null,
      entity_id: 35973,
      timezone_id: null,
      token_login: null,
      last_login: new Date("2026-01-28 14:09:27"),
      last_device: 1,
      mobile_phone_2: null,
      mobile_phone_brand: null,
      mobile_phone_model: null,
      imei_number: null,
      sim_provider: null,
      sim_id: null,
      iota_app_gui_theme: null,
      permission: null,
      application_version: null,
      last_mobile_access: null,
      view_only: 0,
      change_password: null,
      manufacture_id: null,
      fcm_token: "",
      created_by: null,
      updated_by: null,
      deleted_by: null,
      keycloak_uuid: "2fc05210-08c9-4508-b57d-5b9fef35f29e",
      user_uuid: "a6a898b2-8e7b-4e31-8fa2-e90f7da1b9dd",
      external_properties: null,
      status: 1,
      daily_recap_email: 0,
    },
  ]

  for (const user of users) {
    await db
      .insertInto("users")
      .values(user)
      .onDuplicateKeyUpdate({
        username: user.username,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
        entity_id: user.entity_id,
        keycloak_uuid: user.keycloak_uuid,
        user_uuid: user.user_uuid,
        status: user.status,
      })
      .execute()
  }
}
