import { DB } from "@/common/infrastructure/database/types/db.js"
import { originalRedis as redis } from "@/common/infrastructure/redis.js"
import { env } from "@/config/env.js"
import {
  EntityDtos,
  GetEntitiesQueries,
  TEntityDto,
} from "@/modules/entity/entity.schema.js"
import { Context as ContextDB } from "@smile-health/lib/types/context.js"
import { associate, collect } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import { Expression, sql, SqlBool } from "kysely"
import { BaseRepository } from "../base.repository"

export class EntityRepository extends BaseRepository<"entities"> {
  constructor() {
    super("entities")
  }

  readonly #getTranslation = (
    c: Context,
    key: string,
    column: string | null
  ) => {
    if (!column) return null
    const result = c.var.t(`${key}.${column}`)
    return result.includes(".label.") ? key : result
  }

  async getActiveEntities(c: Context) {
    const rows = await c.var.trx
      .selectFrom("entities")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .where("type", "=", 2)
      .where("status", "=", 1)
      .orderBy("id")
      .execute()

    return rows.map((r) => ({ id: Number(r.id), name: String(r.name) }))
  }

  private async invalidateEntityCache(entityId?: number): Promise<void> {
    if (!env.ENABLE_CACHE) return

    try {
      // Get all cache keys that match entity patterns
      const patterns = ["entity:*", "notification:*"]

      for (const pattern of patterns) {
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.del(...keys)
        }
      }

      console.log("Entity cache invalidated successfully")
    } catch (error) {
      console.warn("Failed to invalidate entity cache:", error)
    }
  }

  #generateQueryWhereClause(c: Context, query, params: GetEntitiesQueries) {
    const {
      keyword,
      id_satu_sehat,
      type_ids,
      entity_tag_ids,
      program_ids,
      province_ids,
      regency_ids,
      sub_district_ids,
      village_ids,
      is_vendor,
    } = params

    if (keyword) {
      query = query.where((eb) =>
        eb.or([
          eb("e.name", "like", `%${keyword}%`),
          eb("e.code", "like", `%${keyword}%`),
        ])
      )
    }

    if (type_ids) {
      query = query.where("e.type", "in", type_ids)
    }

    if (id_satu_sehat) {
      query = query.where((eb) => {
        const conditions = id_satu_sehat.map((code) =>
          eb('e.id_satu_sehat', 'like', `%${code}%`)
        );
        return eb.or(conditions);
      })
    }

    if (entity_tag_ids) {
      query = query.where("entity_tag_id", "in", entity_tag_ids)
    }

    if (village_ids) {
      query = query.where("e.village_id", "in", village_ids)
    }
    if (sub_district_ids) {
      query = query.where("e.sub_district_id", "in", sub_district_ids)
    }
    if (regency_ids) {
      query = query.where("e.regency_id", "in", regency_ids)
    }
    if (province_ids) {
      query = query.where("e.province_id", "in", province_ids)
    }
    if (is_vendor !== undefined) {
      query = query.where("e.is_vendor", "=", is_vendor)
    }

    if (program_ids) {
      query = query.where(
        "e.id",
        "in",
        c.var.trx
          .selectFrom("entity_workspaces")
          .select("entity_id")
          .where("workspace_id", "in", program_ids.map(Number))
      )
    }

    return query
  }

  async getListEntity(c: Context, params: GetEntitiesQueries) {
    const { page, paginate, sort_by, sort_type } = params
    const offset = (page - 1) * paginate
    const { client, trx } = c.var
    let query = trx
      .selectFrom("entities as e")
      .select([
        sql`a.metadata`.as("external_properties"),
        "a.client_id as integration_client_id",
      ])
      .leftJoin("integration_associations as a", (join) =>
        join.onRef("a.internal_id", "=", "e.id").on("a.type", "=", "entity")
      )
      .leftJoin("entity_tags as e_tags", (join) =>
        join
          .onRef("e_tags.id", "=", "e.entity_tag_id")
          .on("e_tags.deleted_at", "is", null)
      )
      .leftJoin("entity_types as e_types", (join) =>
        join
          .onRef("e_types.id", "=", "e.type")
          .on("e_types.deleted_at", "is", null)
      )
      .leftJoin("locations as p", "p.id", "e.province_id")
      .leftJoin("locations as r", "r.id", "e.regency_id")
      .leftJoin("locations as sd", "sd.id", "e.sub_district_id")
      .leftJoin("locations as v", "v.id", "e.village_id")
      .$if(!!client, (qb) => qb.where("a.client_id", "=", client!.getId()))
      .where("e.deleted_at", "is", null)

    let countQuery = trx
      .selectFrom("entities as e")
      .leftJoin("integration_associations as a", (join) =>
        join.onRef("a.internal_id", "=", "e.id").on("a.type", "=", "entity")
      )
      .$if(!!client, (qb) => qb.where("a.client_id", "=", client!.getId()))
      .where("e.deleted_at", "is", null)

    query = this.#generateQueryWhereClause(c, query, params)
    countQuery = this.#generateQueryWhereClause(c, countQuery, params)

    const [list, totalList] = await Promise.all([
      query
        .select([
          "e.id",
          "e.name",
          "e.code",
          "e.type",
          "e.status",
          "e.entity_tag_id",
          "e.province_id",
          "e.regency_id",
          "e.sub_district_id",
          "e.village_id",
          "e.id_satu_sehat",
          "e.is_puskesmas",
          "e.is_vendor",
          "e_tags.id as tag_id",
          "e_tags.title as tag",
          "e_types.id as type_id",
          "e_types.name as type_name",
          sql<string>`CONCAT_WS(', ', v.name, sd.name, r.name, p.name)`.as(
            "location"
          ),
          "p.id as province_id",
          "r.id as regency_id",
          "sd.id as sub_district_id",
          "v.id as village_id",
          "p.name as province_name",
          "r.name as regency_name",
          "sd.name as sub_district_name",
          "v.name as village_name",
          "p.level as province_level",
          "r.level as regency_level",
          "sd.level as sub_district_level",
          "v.level as village_level",
        ]) // Do NOT select e.external_properties here
        .$if(!!sort_by, (qb) => {
          // Only allow sorting by these columns
          const allowedSortColumns = [
            "name",
            "location",
            "tag",
            "code",
            "id_satu_sehat",
          ]
          if (
            typeof sort_by === "string" &&
            allowedSortColumns.includes(sort_by)
          ) {
            return qb.orderBy(`e.${sort_by}`, sort_type ?? "asc")
          }
          return qb
        })
        .limit(paginate)
        .offset(offset)
        .execute(),
      countQuery.select([sql`count(*)`.as("total")]).executeTakeFirst(),
    ])

    return {
      list: list.map((entity) => ({
        ...entity,
        tag: this.#getTranslation(c, "entity_tag.label", entity.tag),
        type_name: this.#getTranslation(
          c,
          "entity_type.label",
          entity.type_name
        ),
      })),
      total: Number(totalList?.total) || 0,
    }
  }

  async exists(
    c: Context,
    id: number,
    entityType?: number
  ): Promise<number | null> {
    const row = await c.var.trx
      .selectFrom("entities")
      .select(["id"])
      .where("deleted_at", "is", null)
      .where("status", "=", 1)
      .$if(entityType != null, (qb) => qb.where("type", "=", entityType!))
      .where("id", "=", id)
      .executeTakeFirst()

    return row?.id ?? null
  }

  async findById(c: Context, entityID: number, withDetails = true) {
    const { client, trx } = c.var

    const entity = await trx
      .selectFrom("entities as e")
      .leftJoin("integration_associations as a", (join) =>
        join.onRef("a.internal_id", "=", "e.id").on("a.type", "=", "entity")
      )
      .$if(!!client, (qb) => qb.where("a.client_id", "=", client!.getId()))
      .select(["a.metadata", "a.client_id as integration_client_id"])
      .where("e.id", "=", entityID)
      .selectAll("e")
      .executeTakeFirstOrThrow()

    if (!withDetails) {
      return entity
    }

    const locationIds = [
      entity.village_id,
      entity.sub_district_id,
      entity.regency_id && entity.regency_id !== ""
        ? entity.regency_id
        : entity.metadata?.regency_id,
      entity.province_id,
    ].map(Number)

    const [tag, locations, type] = await Promise.all([
      trx
        .selectFrom("entity_tags")
        .select(["entity_tags.id", "entity_tags.title"])
        .where("id", "=", entity.entity_tag_id)
        .executeTakeFirst(),
      trx
        .selectFrom("locations")
        .select(["locations.id", "locations.name", "locations.level"])
        .orderBy("locations.level")
        .where(
          "id",
          "in",
          locationIds.filter((id) => !isNaN(id))
        )
        .execute(),
      trx
        .selectFrom("entity_types")
        .select(["id", "name"])
        .where("id", "=", entity.type)
        .execute(),
    ])

    const { metadata, ...restEntity } = entity

    return {
      ...restEntity,
      external_properties: metadata ?? entity.external_properties,
      entity_tag: tag
        ? {
          ...tag,
          title: this.#getTranslation(c, "entity_tag.label", tag.title),
        }
        : tag,
      entity_type: type.map((t) => ({
        ...t,
        name: this.#getTranslation(c, "entity_type.label", t.name),
      })),
      locations,
    }
  }

  async findByIds(c: Context, entityIDs: number[]): Promise<TEntityDto[]> {
    const trx = c.var.trx
    const entity = await trx
      .selectFrom("entities")
      .where("id", "in", entityIDs)
      .selectAll()
      .execute()

    return EntityDtos.parse(entity)
  }

  async findByCode(c: Context, code: string) {
    return await c.var.trx
      .selectFrom("entities")
      .where("code", "=", code)
      .selectAll()
      .executeTakeFirst()
  }

  async findByCodes(c: Context, codes: string[]) {
    return await c.var.trx
      .selectFrom("entities")
      .where("code", "in", codes)
      .selectAll()
      .execute()
  }

  async findByIdSatuSehat(c: Context, idSatuSehat: number[]) {
    if (idSatuSehat.length === 0) return []
    return await c.var.trx
      .selectFrom("entities")
      .where("id_satu_sehat", "in", idSatuSehat)
      .selectAll()
      .execute()
  }

  async findByCodeAndExceptId(c: Context, code: string, entityID: number) {
    return await c.var.trx
      .selectFrom("entities")
      .where("code", "=", code)
      .where("id", "<>", entityID)
      .selectAll()
      .executeTakeFirst()
  }

  async findBasicById(c: Context, entityID: number) {
    const { client, trx } = c.var

    const entity = await trx
      .selectFrom("entities as e")
      .leftJoin("locations as prov", "prov.id", "e.province_id")
      .leftJoin("locations as city", "city.id", "e.regency_id")
      .leftJoin(
        "locations as sub_district",
        "sub_district.id",
        "e.sub_district_id"
      )
      .leftJoin("integration_associations as a", (join) =>
        join.onRef("a.internal_id", "=", "e.id").on("a.type", "=", "entity")
      )
      .leftJoin("locations as village", "village.id", "e.village_id")
      .leftJoin("entity_types as ets", "ets.id", "e.type")
      .leftJoin("entity_tags as et", "et.id", "e.entity_tag_id")
      .$if(!client, (qb) => qb.select(["e.external_properties"]))
      .select([
        "e.id",
        "e.name",
        "e.type",
        "e.address",
        "et.title as tag",
        "e.province_id",
        "e.regency_id",
        "e.sub_district_id",
        "e.village_id",
        "e.integration_type",
        sql<string>`if(ets.id IS NULL, NULL, JSON_OBJECT(
          'id', ets.id,
          'name', ets.name,
          'integration_type', ets.integration_type,
          'external_properties', ets.external_properties
        ))`.as("entity_type"),
        "a.metadata as external_properties",
        "a.client_id as integration_client_id",
      ])
      .select(
        sql<string>`CONCAT_WS(', ', village.name, sub_district.name, city.name, prov.name)`.as(
          "location"
        )
      )
      .where("e.id", "=", entityID)
      .$if(!!client, (qb) => qb.where("a.client_id", "=", client!.getId()))
      .executeTakeFirst()

    if (!entity) return entity
    return {
      ...entity,
      tag: this.#getTranslation(c, "entity_tag.label", entity.tag),
    }
  }

  async findBasicAllByIds(c: Context, entityIDs: number[]) {
    const entities = await c.var.trx
      .selectFrom("entities as e")
      .leftJoin("locations as prov", "prov.id", "e.province_id")
      .leftJoin("locations as city", "city.id", "e.regency_id")
      .leftJoin("entity_tags as et", "et.id", "e.entity_tag_id")
      .select(["e.id", "e.name", "e.type", "e.address", "et.title as tag"])
      .select(sql<string>`concat(city.name, ', ', prov.name)`.as("location"))
      .where("e.id", "in", entityIDs)
      .execute()

    return associate(
      entities.map((entity) => ({
        ...entity,
        tag: this.#getTranslation(c, "entity_tag.label", entity.tag),
      })),
      "id"
    )
  }

  async findAllSearchableAndStreamable(
    c: ContextDB<DB>,
    params: GetEntitiesQueries
  ) {
    return c.var.trx
      .selectFrom("entities as e")
      .leftJoin("locations as prov", "prov.id", "e.province_id")
      .leftJoin("locations as reg", "reg.id", "e.regency_id")
      .leftJoin("locations as vil", "vil.id", "e.village_id")
      .leftJoin("locations as sub", "sub.id", "e.sub_district_id")
      .leftJoin("entity_types as et", "et.id", "e.type")
      .leftJoin("entity_tags as tag", "tag.id", "e.entity_tag_id")
      .leftJoin("entity_workspaces as ework", "ework.entity_id", "e.id")
      .leftJoin("workspaces as work", "work.id", "ework.workspace_id")
      .leftJoin("users as u", "u.id", "e.created_by")
      .where((query) => {
        const filters: Expression<SqlBool>[] = []
        if (params.keyword) {
          filters.push(query("e.name", "like", `%${params.keyword}%`))
        }
        if (params.province_ids) {
          filters.push(query("e.province_id", "in", params.province_ids))
        }
        if (params.regency_ids) {
          filters.push(query("e.regency_id", "in", params.regency_ids))
        }
        if (params.sub_district_ids) {
          filters.push(
            query("e.sub_district_id", "in", params.sub_district_ids)
          )
        }
        if (params.village_ids) {
          filters.push(query("e.village_id", "in", params.village_ids))
        }
        if (params.entity_tag_ids) {
          const entityTagIds = params.entity_tag_ids
            .map(Number)
            .filter((id) => !isNaN(id))
          filters.push(query("e.entity_tag_id", "in", entityTagIds))
        }
        if (params.type_ids) {
          const typeIds = params.type_ids.map(Number).filter((id) => !isNaN(id))
          filters.push(query("e.type", "in", typeIds))
        }
        return query.and(filters)
      })
      .$if(!!params.program_ids, (qb) =>
        qb.where(
          "e.id",
          "in",
          c.var.trx
            .selectFrom("entity_workspaces")
            .select("entity_id")
            .where("workspace_id", "in", params.program_ids!.map(Number))
        )
      )
      .select([
        "e.id",
        "e.type",
        "et.name as type_name",
        "e.name",
        "e.address",
        "e.village_id",
        "vil.name as village_name",
        "e.code",
        "e.province_id",
        "prov.name as province_name",
        "e.regency_id",
        "reg.name as regency_name",
        "e.sub_district_id",
        "sub.name as sub_district_name",
        "e.id_satu_sehat",
        "e.status",
        "tag.title as entity_tag_name",
        "u.username as created_by_name",
        "e.id_satu_sehat",
        "e.updated_at",
        sql<string>`DATE_FORMAT(e.updated_at, '%d %M %Y')`.as("updated_at"),
        sql<string>`group_concat(work.name separator ', ')`.as("programs"),
      ])
      .stream()
  }

  async save(c: Context, data: TEntityDto): Promise<number> {
    const entity = await c.var.trx
      .insertInto("entities")
      .values(data)
      .executeTakeFirst()

    // Invalidate cache after creating new entity
    this.invalidateEntityCache()

    return Number(entity.insertId)
  }

  async update(c: Context, data: TEntityDto, entityID: number) {
    await c.var.trx
      .updateTable("entities")
      .set(data)
      .where("id", "=", entityID)
      .executeTakeFirst()

    // Invalidate cache after update
    this.invalidateEntityCache(entityID)
  }

  async getIdAndNameStream(c: Context) {
    return c.var.trx
      .selectFrom("entities as e")
      .where("e.deleted_at", "is", null)
      .select(["e.id", "e.name"])
      .stream()
  }

  async findInWorkspace(c: Context, id: number) {
    const records = await c.var.trx
      .selectFrom("entity_workspaces")
      .innerJoin("entities", "entities.id", "entity_workspaces.entity_id")
      .where("entity_id", "=", id)
      .selectAll("entities")
      .select([
        "entity_workspaces.id as ws_id",
        "entity_workspaces.workspace_id as program_id",
      ])
      .execute()

    return records
  }

  async findInCustomerVendor(c: Context, id: number) {
    const rows = await c.var.trx
      .selectFrom("entity_workspaces")
      .select("id")
      .where("entity_id", "=", id)
      .execute()
    if (rows.length === 0) {
      return false
    }

    const entityIds = collect(rows, "id")

    const exist = await c.var.trx
      .selectFrom("ws_customer_vendors")
      .where((eb) =>
        eb("customer_id", "in", entityIds).or(eb("vendor_id", "in", entityIds))
      )
      .select("id")
      .limit(1)
      .executeTakeFirst()

    return !!exist
  }

  async getListEntityIsAsset(
    c: Context,
    entityId: number,
    params: GetEntitiesQueries,
    provinceId?: number,
    regencyId?: number,
    subDistrictId?: number,
    villageId?: number
  ) {
    const { page, paginate, sort_by, sort_type } = params
    const offset = (page - 1) * paginate
    const { client, trx } = c.var

    let query = trx
      .selectFrom("entities as e")
      .select([
        sql`a.metadata`.as("external_properties"),
        "a.client_id as integration_client_id",
      ])
      .leftJoin("integration_associations as a", (join) =>
        join.onRef("a.internal_id", "=", "e.id").on("a.type", "=", "entity")
      )
      .leftJoin("entity_tags as e_tags", (join) =>
        join
          .onRef("e_tags.id", "=", "e.entity_tag_id")
          .on("e_tags.deleted_at", "is", null)
      )
      .leftJoin("entity_types as e_types", (join) =>
        join
          .onRef("e_types.id", "=", "e.type")
          .on("e_types.deleted_at", "is", null)
      )
      .leftJoin("locations as p", "p.id", "e.province_id")
      .leftJoin("locations as r", "r.id", "e.regency_id")
      .leftJoin("locations as sd", "sd.id", "e.sub_district_id")
      .leftJoin("locations as v", "v.id", "e.village_id")
      .$if(!!client, (qb) => qb.where("a.client_id", "=", client!.getId()))
      .where("e.deleted_at", "is", null)
      .where("e.id", "!=", entityId)

    let countQuery = trx
      .selectFrom("entities as e")
      .leftJoin("integration_associations as a", (join) =>
        join.onRef("a.internal_id", "=", "e.id").on("a.type", "=", "entity")
      )
      .$if(!!client, (qb) => qb.where("a.client_id", "=", client!.getId()))
      .where("e.deleted_at", "is", null)

    const isNullOrEmpty = (eb: any, field: string) => {
      return eb.or([eb(field, "is", null), eb(field, "=", "")])
    }

    const isNotNullOrEmpty = (eb: any, field: string) => {
      return eb.and([eb(field, "is not", null), eb(field, "!=", "")])
    }

    // LEVEL 1: Province Level
    if (provinceId && !regencyId && !subDistrictId && !villageId) {
      query = query
        .where("e.country", "=", "ID")
        .where((eb) => isNotNullOrEmpty(eb, "e.province_id"))
        .where((eb) => isNullOrEmpty(eb, "e.regency_id"))

      countQuery = countQuery
        .where("e.country", "=", "ID")
        .where((eb) => isNotNullOrEmpty(eb, "e.province_id"))
        .where((eb) => isNullOrEmpty(eb, "e.regency_id"))
    }

    // LEVEL 2: Regency Level
    if (provinceId && regencyId && !subDistrictId && !villageId) {
      const regencyValidation = await trx
        .selectFrom("locations")
        .select("id")
        .where("id", "=", regencyId)
        .where("parent_id", "=", provinceId)
        .executeTakeFirst()

      if (!regencyValidation) {
        return {
          list: [],
          total: 0,
        }
      }

      query = query
        .where("e.province_id", "=", String(provinceId))
        .where((eb) => {
          return eb.or([
            eb.and([
              isNotNullOrEmpty(eb, "e.regency_id"),
              isNullOrEmpty(eb, "e.sub_district_id"),
            ]),
            // Province parent
            eb.and([isNullOrEmpty(eb, "e.regency_id")]),
          ])
        })

      countQuery = countQuery
        .where("e.province_id", "=", String(provinceId))
        .where((eb) => {
          return eb.or([
            eb.and([
              isNotNullOrEmpty(eb, "e.regency_id"),
              isNullOrEmpty(eb, "e.sub_district_id"),
            ]),
            // Province parent
            eb.and([isNullOrEmpty(eb, "e.regency_id")]),
          ])
        })
    }

    // LEVEL 3: Sub District Level
    if (provinceId && regencyId && subDistrictId && !villageId) {
      const hierarchyValidation = await trx
        .selectFrom("locations as sd")
        .innerJoin("locations as r", "r.id", "sd.parent_id")
        .select("sd.id")
        .where("sd.id", "=", subDistrictId)
        .where("sd.parent_id", "=", regencyId)
        .where("r.parent_id", "=", provinceId)
        .executeTakeFirst()

      if (!hierarchyValidation) {
        return {
          list: [],
          total: 0,
        }
      }

      query = query
        .where("e.province_id", "=", String(provinceId))
        .where((eb) => {
          return eb.or([
            eb.and([
              eb("e.regency_id", "=", String(regencyId)),
              isNotNullOrEmpty(eb, "e.sub_district_id"),
              isNullOrEmpty(eb, "e.village_id"),
            ]),
            // Regency parent
            eb.and([
              eb("e.regency_id", "=", String(regencyId)),
              isNullOrEmpty(eb, "e.sub_district_id"),
            ]),
          ])
        })

      countQuery = countQuery
        .where("e.province_id", "=", String(provinceId))
        .where((eb) => {
          return eb.or([
            eb.and([
              eb("e.regency_id", "=", String(regencyId)),
              isNotNullOrEmpty(eb, "e.sub_district_id"),
              isNullOrEmpty(eb, "e.village_id"),
            ]),
            // Regency parent
            eb.and([
              eb("e.regency_id", "=", String(regencyId)),
              isNullOrEmpty(eb, "e.sub_district_id"),
            ]),
          ])
        })
    }

    // LEVEL 4: Village Level
    if (provinceId && regencyId && subDistrictId && villageId) {
      const hierarchyValidation = await trx
        .selectFrom("locations as v")
        .innerJoin("locations as sd", "sd.id", "v.parent_id")
        .innerJoin("locations as r", "r.id", "sd.parent_id")
        .select("v.id")
        .where("v.id", "=", villageId)
        .where("v.parent_id", "=", subDistrictId)
        .where("sd.parent_id", "=", regencyId)
        .where("r.parent_id", "=", provinceId)
        .executeTakeFirst()

      if (!hierarchyValidation) {
        return {
          list: [],
          total: 0,
        }
      }

      query = query
        .where("e.province_id", "=", String(provinceId))
        .where((eb) => {
          return eb.or([
            eb.and([
              eb("e.regency_id", "=", String(regencyId)),
              eb("e.sub_district_id", "=", String(subDistrictId)),
              isNotNullOrEmpty(eb, "e.village_id"),
            ]),
            // Sub District parent
            eb.and([
              eb("e.regency_id", "=", String(regencyId)),
              eb("e.sub_district_id", "=", String(subDistrictId)),
              isNullOrEmpty(eb, "e.village_id"),
            ]),
          ])
        })

      countQuery = countQuery
        .where("e.province_id", "=", String(provinceId))
        .where((eb) => {
          return eb.or([
            eb.and([
              eb("e.regency_id", "=", String(regencyId)),
              eb("e.sub_district_id", "=", String(subDistrictId)),
              isNotNullOrEmpty(eb, "e.village_id"),
            ]),
            // Sub District parent
            eb.and([
              eb("e.regency_id", "=", String(regencyId)),
              eb("e.sub_district_id", "=", String(subDistrictId)),
              isNullOrEmpty(eb, "e.village_id"),
            ]),
          ])
        })
    }

    // Keyword search
    if (params.keyword) {
      query = query.where((eb) =>
        eb.or([
          eb("e.name", "like", `%${params.keyword}%`),
          eb("e.code", "like", `%${params.keyword}%`),
        ])
      )
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("e.name", "like", `%${params.keyword}%`),
          eb("e.code", "like", `%${params.keyword}%`),
        ])
      )
    }

    const [list, totalList] = await Promise.all([
      query
        .select([
          "e.id",
          "e.name",
          "e.code",
          "e.type",
          "e.status",
          "e.entity_tag_id",
          "e.province_id",
          "e.regency_id",
          "e.sub_district_id",
          "e.village_id",
          "e.id_satu_sehat",
          "e.is_puskesmas",
          "e.is_vendor",
          "e_tags.id as tag_id",
          "e_tags.title as tag",
          "e_types.id as type_id",
          "e_types.name as type_name",
          sql<string>`CONCAT_WS(', ', v.name, sd.name, r.name, p.name)`.as(
            "location"
          ),
          "p.id as province_id",
          "r.id as regency_id",
          "sd.id as sub_district_id",
          "v.id as village_id",
          "p.name as province_name",
          "r.name as regency_name",
          "sd.name as sub_district_name",
          "v.name as village_name",
          "p.level as province_level",
          "r.level as regency_level",
          "sd.level as sub_district_level",
          "v.level as village_level",
        ])
        .$if(!!sort_by, (qb) => {
          const allowedSortColumns = [
            "name",
            "location",
            "tag",
            "code",
            "id_satu_sehat",
          ]
          if (
            typeof sort_by === "string" &&
            allowedSortColumns.includes(sort_by)
          ) {
            return qb.orderBy(`e.${sort_by}`, sort_type ?? "asc")
          }
          return qb
        })
        .groupBy("e.id")
        .limit(paginate)
        .offset(offset)
        .execute(),
      countQuery.select([sql`count(*)`.as("total")]).executeTakeFirst(),
    ])

    return {
      list: list.map((entity) => ({
        ...entity,
        tag: this.#getTranslation(c, "entity_tag.label", entity.tag),
        type_name: this.#getTranslation(
          c,
          "entity_type.label",
          entity.type_name
        ),
      })),
      total: Number(totalList?.total) || 0,
    }
  }
}
