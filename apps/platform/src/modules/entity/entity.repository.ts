import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context, CustomContext } from "@smile/lib/types/context.js"
import { associate } from "@smile/lib/utils.js"
import { TGlobalEntityDto } from "@smile/lib/types/global.schema.js"
import { sql } from "kysely"
import { GetEntitiesQueries } from "./entity.schema.js"
import env from "@/config/env.js"

export class EntityRepository {
  #generateQueryWhereClause(dataObject) {
    const { keyword, type_ids, province_ids, regency_ids, sub_district_ids } =
      dataObject
    let { query } = dataObject
    if (keyword) {
      query = query.where("e.name", "like", `%${keyword}%`)
    }

    if (type_ids) {
      query = query.where("e.type", "in", type_ids)
    }

    if (sub_district_ids) {
      query = query.where("e.sub_district_id", "in", sub_district_ids)
    } else if (regency_ids) {
      query = query.where("e.regency_id", "in", regency_ids)
    } else if (province_ids) {
      query = query.where("e.province_id", "in", province_ids)
    }

    return query
  }

  async getListEntity(c: Context<DB>, params: GetEntitiesQueries) {
    const {
      page,
      paginate,
      keyword,
      type_ids,
      entity_tag_ids,
      province_ids,
      regency_ids,
      sub_district_ids,
    } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom("entities as e")
      .leftJoin("provinces as p", "p.id", "e.province_id")
      .leftJoin("regencies as r", "r.id", "e.regency_id")
      .leftJoin("sub_districts as sd", "sd.id", "e.sub_district_id")
      .leftJoin("villages as v", "v.id", "e.village_id")
      .leftJoin("entity_entity_tags as eet", "eet.entity_id", "e.id")

    let listEntityTags = c.var.trx
      .selectFrom("entity_tags")
      .select(["id", "title"])

    if (entity_tag_ids) {
      listEntityTags = listEntityTags.where("id", "in", entity_tag_ids)
      query = query.innerJoin(
        listEntityTags.as("et"),
        "eet.entity_tag_id",
        "et.id"
      )
    } else {
      query = query.leftJoin(
        listEntityTags.as("et"),
        "eet.entity_tag_id",
        "et.id"
      )
    }

    query = this.#generateQueryWhereClause({
      query,
      keyword,
      type_ids,
      province_ids,
      regency_ids,
      sub_district_ids,
    })

    const listEntity = await query
      .where("e.deleted_at", "is", null)
      .select([
        "e.id",
        "e.code",
        "e.name",
        "e.status",
        sql<string>`et.title`.as("entity_tag_name"),
        sql<string>`CONCAT_WS(', ', v.name, sd.name, r.name, p.name)`.as(
          "location"
        ),
      ])
      .limit(paginate)
      .offset(offset)
      .execute()
    return listEntity
  }

  async getTotalCountEntity(c: Context<DB>, params: GetEntitiesQueries) {
    const {
      keyword,
      type_ids,
      entity_tag_ids,
      province_ids,
      regency_ids,
      sub_district_ids,
    } = params

    let query = c.var.trx
      .selectFrom("entities as e")
      .leftJoin("entity_entity_tags as eet", "eet.entity_id", "e.id")
    if (entity_tag_ids) {
      query = query.innerJoin("entity_tags as et", (join) =>
        join
          .onRef("et.id", "=", "eet.entity_tag_id")
          .on("et.id", "in", entity_tag_ids)
      )
    }

    query = this.#generateQueryWhereClause({
      query,
      keyword,
      type_ids,
      province_ids,
      regency_ids,
      sub_district_ids,
    })

    const totalEntity = await query
      .where("e.deleted_at", "is", null)
      .select((eb) => eb.fn.countAll().as("total"))
      .executeTakeFirst()

    return Number(totalEntity?.total) || 0
  }

  async findByCodeOrGlobalId(c: Context<DB>, code: string, globalID: number) {
    return c.var.trx
      .selectFrom("entities")
      .where((cb) =>
        cb.or([cb("global_id", "=", globalID), cb("code", "=", code)])
      )
      .selectAll()
      .executeTakeFirst()
  }

  async getEntityDetail(c: Context<DB>, id: number) {
    const totalEntity = await c.var.trx
      .selectFrom("entities as e")
      .leftJoin("provinces as p", "p.id", "e.province_id")
      .leftJoin("regencies as r", "r.id", "e.regency_id")
      .leftJoin("sub_districts as sd", "sd.id", "e.sub_district_id")
      .leftJoin("villages as v", "v.id", "e.village_id")
      .leftJoin("entity_entity_tags as eet", "eet.entity_id", "e.id")
      .leftJoin("entity_tags as et", "et.id", "eet.entity_tag_id")
      .select([
        "e.id",
        "e.code",
        "e.name",
        "e.status",
        "e.lat",
        "e.lng",
        "e.address",
        "e.type",
        "e.updated_at",
        "e.is_vendor",
        sql<string>`CONCAT_WS(', ', v.name, sd.name, r.name, p.name)`.as(
          "location"
        ),
        "eet.entity_tag_id as entity_tag_id",
        "et.title as entity_tag_name",
      ])
      .where("e.id", "=", id)
      .where("e.deleted_at", "is", null)
      .executeTakeFirst()

    return totalEntity
  }

  async getEntitiesStreamData(c: Context<DB>, params: GetEntitiesQueries) {
    const {
      keyword,
      type_ids,
      entity_tag_ids,
      province_ids,
      regency_ids,
      sub_district_ids,
    } = params

    // Handle big data query using stream process
    let query = c.var.trx
      .selectFrom("entities as e")
      .leftJoin("provinces as p", "p.id", "e.province_id")
      .leftJoin("regencies as r", "r.id", "e.regency_id")
      .leftJoin("sub_districts as sd", "sd.id", "e.sub_district_id")
      .leftJoin("villages as v", "v.id", "e.village_id")
      .leftJoin("entity_entity_tags as eet", "eet.entity_id", "e.id")
      .leftJoin("users as u", "u.id", "e.created_by")

    let listEntityTags = c.var.trx
      .selectFrom("entity_tags")
      .select(["id", "title"])

    if (entity_tag_ids) {
      listEntityTags = listEntityTags.where("id", "in", entity_tag_ids)
      query = query.innerJoin(
        listEntityTags.as("et"),
        "eet.entity_tag_id",
        "et.id"
      )
    } else {
      query = query.leftJoin(
        listEntityTags.as("et"),
        "eet.entity_tag_id",
        "et.id"
      )
    }

    query = this.#generateQueryWhereClause({
      query,
      keyword,
      type_ids,
      province_ids,
      regency_ids,
      sub_district_ids,
    })

    const stream = query
      .where("e.deleted_at", "is", null)
      .select([
        "e.id",
        "e.type",
        "e.name",
        "e.address",
        "e.village_id",
        "v.name as village_name",
        "e.code",
        "e.province_id",
        "p.name as province_name",
        "e.regency_id",
        "r.name as regency_name",
        "e.sub_district_id",
        "sd.name as sub_district_name",
        "e.status",
        sql<string>`et.title`.as("entity_tag_name"),
        "e.is_vendor",
        "e.updated_at",
        sql<string>`CONCAT_WS(' ', u.firstname, u.lastname)`.as(
          "full_user_name"
        ),
      ])
      .stream()

    return stream
  }

  async getBasicDetailMapped(c: Context<DB>, entityIds: number[]) {
    const entities = await c.var.trx
      .selectFrom("entities as e")
      .leftJoin("provinces as prov", "prov.id", "e.province_id")
      .leftJoin("regencies as city", "city.id", "e.regency_id")
      .leftJoin("entity_entity_tags as eet", "eet.entity_id", "e.id")
      .leftJoin("entity_tags as et", "et.id", "eet.entity_tag_id")
      .select(["e.id", "e.name", "e.type", "e.address", "et.title as tag"])
      .select(sql<string>`concat(city.name, ', ', prov.name)`.as("location"))
      .where("e.id", "in", entityIds)
      .execute()

    return associate(entities, "id")
  }

  async getBasicDetail(c: Context<DB>, entityID: number) {
    const entity = await c.var.trx
      .selectFrom("entities as e")
      .leftJoin("provinces as prov", "prov.id", "e.province_id")
      .leftJoin("regencies as city", "city.id", "e.regency_id")
      .leftJoin("entity_entity_tags as eet", "eet.entity_id", "e.id")
      .leftJoin("entity_tags as et", "et.id", "eet.entity_tag_id")
      .select(["e.id", "e.name", "e.type", "e.address", "et.title as tag"])
      .select(sql<string>`concat(city.name, ', ', prov.name)`.as("location"))
      .where("e.id", "=", entityID)
      .executeTakeFirst()

    return entity
  }

  async updateStatusEntity(c: Context<DB>, status: number, id: number) {
    const result = await c.var.trx
      .updateTable("entities")
      .set({ status })
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return result
  }

  async checkActiveOrder(c: Context<DB>, id: number) {
    const activeOrder = await c.var.trx
      .selectFrom("orders")
      .select(["customer_id", "vendor_id"])
      .where("deleted_at", "is", null)
      .where((eb) =>
        eb.or([eb("customer_id", "=", id), eb("vendor_id", "=", id)])
      )
      .executeTakeFirst()

    return activeOrder
  }

  async checkRelationCustomerVendor(c: Context<DB>, id: number) {
    const customerVendorRelation = await c.var.trx
      .selectFrom("customer_vendors")
      .select(["customer_id", "vendor_id"])
      .where("deleted_at", "is", null)
      .where((eb) =>
        eb.or([eb("customer_id", "=", id), eb("vendor_id", "=", id)])
      )
      .executeTakeFirst()

    return customerVendorRelation
  }

  async createFromGlobalEntity(c: CustomContext<DB>, req: TGlobalEntityDto) {
    const trx = c.var.trx
    const { entity_tag_id, workspace_ids, ...globalEntity } = req
    const workspaceIDs = workspace_ids ?? []

    globalEntity.status = workspaceIDs.includes(env.WORKSPACE_ID) ? 1 : 0

    const entity = await trx
      .insertInto("entities")
      .values(globalEntity)
      .executeTakeFirst()

    if (entity_tag_id && entity.insertId) {
      const entityTags = {
        entity_id: Number(entity.insertId),
        entity_tag_id: entity_tag_id,
      }

      await trx
        .insertInto("entity_entity_tags")
        .values(entityTags)
        .executeTakeFirst()
    }
  }

  async updateFromGlobalEntity(
    c: CustomContext<DB>,
    req: TGlobalEntityDto,
    entityID: number
  ) {
    const trx = c.var.trx
    const { entity_tag_id, workspace_ids, ...globalEntity } = req

    await trx
      .updateTable("entities")
      .set(globalEntity)
      .where("id", "=", entityID)
      .executeTakeFirst()

    if (entity_tag_id) {
      trx
        .deleteFrom("entity_entity_tags")
        .where("entity_id", "=", entityID)
        .execute()

      const entityTags = {
        entity_id: entityID,
        entity_tag_id: entity_tag_id,
      }

      await trx
        .insertInto("entity_entity_tags")
        .values(entityTags)
        .executeTakeFirst()
    }
  }

  async updateStatusVendorEntity(c: Context<DB>, status: number, id: number) {
    const result = await c.var.trx
      .updateTable("entities")
      .set({ is_vendor: status })
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return result
  }

  async findByIds(c: Context<DB>, id: number[]) {
    return c.var.trx
      .selectFrom("entities")
      .select(["id", "name"])
      .where("id", "in", id)
      .execute()
  }
}
