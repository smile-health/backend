import { Context } from "hono"

export class CommonRepository {
  constructor() {}

  async findUserWithDetails(c: Context, appUserId: string) {
    return await c.var.trx
      .selectFrom("users")
      .leftJoin("entities", "entities.id", "users.entity_id")
      .leftJoin("manufactures", "manufactures.id", "users.manufacture_id")
      .leftJoin("locations as province", "province.id", "entities.province_id")
      .leftJoin("locations as regency", "regency.id", "entities.regency_id")
      .leftJoin(
        "locations as sub_district",
        "sub_district.id",
        "entities.sub_district_id"
      )
      .leftJoin("locations as village", "village.id", "entities.village_id")
      .where("users.user_uuid", "=", appUserId)
      .select([
        "users.id",
        "users.username",
        "users.email",
        "users.firstname",
        "users.lastname",
        "users.gender",
        "users.date_of_birth",
        "users.role",
        "users.token_login",
        "users.village_id",
        "users.entity_id",
        "users.timezone_id",
        "users.status",
        "users.view_only",
        "users.change_password",
        "users.last_login",
        "users.updated_at",
        "entities.id as entity_id",
        "entities.name as entity_name",
        "entities.address as entity_address",
        "entities.type as entity_type",
        "entities.province_id as entity_province_id",
        "entities.regency_id as entity_regency_id",
        "entities.sub_district_id as entity_sub_district_id",
        "entities.village_id as entity_village_id",
        "province.id as province_id",
        "province.name as province_name",
        "regency.id as regency_id",
        "regency.name as regency_name",
        "sub_district.id as sub_district_id",
        "sub_district.name as sub_district_name",
        "village.id as village_id",
        "village.name as village_name",
        "manufactures.id as manufacture_id",
        "manufactures.name as manufacture_name",
        "manufactures.reference_id as manufacture_reference_id",
        "manufactures.description as manufacture_description",
        "manufactures.contact_name as manufacture_contact_name",
        "manufactures.phone_number as manufacture_phone_number",
        "manufactures.email as manufacture_email",
        "manufactures.address as manufacture_address",
        "manufactures.status as manufacture_status",
        "manufactures.type as manufacture_type",
      ])
      .executeTakeFirst()
  }
}
