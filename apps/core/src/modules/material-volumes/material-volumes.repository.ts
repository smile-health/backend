import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import {
  GetMaterialVolumesQueryParams,
  CreateMaterialVolumeDTO,
} from "./material-volumes.schema.js"
import { MATERIAL_LEVEL } from "@/common/constants/material.js"
import { sql } from "kysely"

export class MaterialVolumesRepository extends BaseRepository<"material_volumes"> {
  constructor() {
    super("material_volumes")
  }

  private applyFilters(query: any, queryParam: GetMaterialVolumesQueryParams) {
    let q = query

    if (queryParam.material_ids && queryParam.material_ids.length > 0) {
      q = q.where("mv.material_id", "in", queryParam.material_ids)
    }

    if (queryParam.manufacture_ids && queryParam.manufacture_ids.length > 0) {
      q = q.where("mv.manufacture_id", "in", queryParam.manufacture_ids)
    }

    if (
      queryParam.material_type_ids &&
      queryParam.material_type_ids.length > 0
    ) {
      q = q.where("m.material_type_id", "in", queryParam.material_type_ids)
    }

    return q
  }

  async findAll(c: Context, queryParam: GetMaterialVolumesQueryParams) {
    let query = c.var.trx
      .selectFrom("material_volumes as mv")
      .innerJoin("materials as m", (join) =>
        join.onRef("m.id", "=", "mv.material_id").on("m.deleted_at", "is", null)
      )
      .innerJoin("material_types as mt", (join) =>
        join
          .onRef("mt.id", "=", "m.material_type_id")
          .on("mt.deleted_at", "is", null)
      )
      .innerJoin("manufactures as mf", (join) =>
        join
          .onRef("mf.id", "=", "mv.manufacture_id")
          .on("mf.deleted_at", "is", null)
      )
      .select([
        "mv.id",
        "mv.box_length",
        "mv.box_width",
        "mv.box_height",
        "mv.unit_per_box",
        "mv.updated_at",
        "mv.created_at",
        "mv.created_by",
        "mv.updated_by",
        "mf.name as manufacture_name",
        "mt.name as material_type_name",
        "m.name as material_name",
        "m.consumption_unit_per_distribution_unit",
      ])
      .where("mv.deleted_at", "is", null)

    query = this.applySorting(query, queryParam)
    query = this.applyFilters(query, queryParam)

    const offset = (queryParam.page - 1) * queryParam.paginate
    const isPaginate = !!queryParam.page && !!queryParam.paginate

    const [list, count] = await Promise.all([
      query
        .$if(isPaginate, (qb) => qb.limit(queryParam.paginate).offset(offset))
        .execute(),
      query
        .select((eb) => eb.fn.count("mv.id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: list,
      total: Number(count.total),
    }
  }

  async findById(c: Context, id: number) {
    const result = await c.var.trx
      .selectFrom("material_volumes")
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .selectAll()
      .executeTakeFirst()

    return result
  }

  async create(c: Context, data: CreateMaterialVolumeDTO) {
    const result = await c.var.trx
      .insertInto("material_volumes")
      .values(data)
      .executeTakeFirstOrThrow()

    return result
  }

  getStreamMaterials(c: Context) {
    return c.var.trx
      .selectFrom("material_relations as mr")
      .innerJoin("materials as parent", (join) =>
        join
          .onRef("mr.parent_material_id", "=", "parent.id")
          .on("parent.deleted_at", "is", null)
      )
      .innerJoin("materials as child", (join) =>
        join
          .onRef("mr.child_material_id", "=", "child.id")
          .on("child.deleted_at", "is", null)
      )
      .innerJoin("material_units as child_mu", (join) =>
        join
          .onRef("child.unit_of_distribution_id", "=", "child_mu.id")
          .on("child_mu.deleted_at", "is", null)
      )
      .innerJoin("material_units as child_mu_consumption", (join) =>
        join
          .onRef("child.unit_of_consumption_id", "=", "child_mu_consumption.id")
          .on("child_mu_consumption.deleted_at", "is", null)
      )
      .innerJoin("material_levels as child_ml", (join) =>
        join
          .onRef("child.material_level_id", "=", "child_ml.id")
          .on("child_ml.deleted_at", "is", null)
      )
      .select([
        "child.id as child_id",
        "child.name as child_name",
        "child.description as child_description",
        "child.code as child_code",
        "child.hierarchy_code as child_hierarchy_code",
        "child_ml.name as child_material_level",
        "parent.hierarchy_code as parent_hierarchy_code",
        "parent.name as parent_name",
        "child.consumption_unit_per_distribution_unit",
        "child_mu_consumption.name as unit_of_consumption",
        "child_mu.name as unit_of_distribution",
        "child.is_temperature_sensitive as child_is_temperature_sensitive",
        "child.min_temperature as child_min_temperature",
        "child.max_temperature as child_max_temperature",
      ])
      .where("child.deleted_at", "is", null)
      .where("child.material_level_id", "=", MATERIAL_LEVEL.VARIANT)
      .stream()
  }

  getStreamManufactures(c: Context) {
    return c.var.trx
      .selectFrom("manufactures")
      .select(["id", "name"])
      .where("deleted_at", "is", null)
      .where("status", "=", 1)
      .stream()
  }

  async getStreamMaterialVolumes(
    c: Context,
    queryParam: GetMaterialVolumesQueryParams
  ) {
    let query = c.var.trx
      .selectFrom("material_volumes as mv")
      .innerJoin("materials as m", (join) =>
        join.onRef("m.id", "=", "mv.material_id").on("m.deleted_at", "is", null)
      )
      .innerJoin("manufactures as mf", (join) =>
        join
          .onRef("mf.id", "=", "mv.manufacture_id")
          .on("mf.deleted_at", "is", null)
      )
      .innerJoin("users as u", (join) =>
        join.onRef("u.id", "=", "mv.updated_by").on("u.deleted_at", "is", null)
      )
      .select([
        "mv.id",
        "m.id as material_id",
        "m.name as material_name",
        "mf.id as manufacture_id",
        "mf.name as manufacture_name",
        "m.consumption_unit_per_distribution_unit",
        "mv.unit_per_box",
        "mv.box_length",
        "mv.box_width",
        "mv.box_height",
        "mv.updated_at",
        "mv.updated_by",
        sql<string>`
          CASE
            WHEN (u.firstname IS NOT NULL AND u.firstname != '') 
                AND (u.lastname IS NULL OR u.lastname = '') 
            THEN u.firstname
            WHEN (u.lastname IS NOT NULL AND u.lastname != '') 
                AND (u.firstname IS NULL OR u.firstname = '') 
            THEN u.lastname
            WHEN (u.firstname IS NOT NULL AND u.firstname != '') 
                AND (u.lastname IS NOT NULL AND u.lastname != '') 
            THEN CONCAT(u.firstname, ' ', u.lastname)
            ELSE ''
          END
        `.as("updated_by_name"),
      ])
      .where("mv.deleted_at", "is", null)

    query = this.applyFilters(query, queryParam)
    query = this.applySorting(query, queryParam)

    return query.stream()
  }

  private applySorting(query: any, queryParam: GetMaterialVolumesQueryParams) {
    const sortMapping = {
      material_name: "m.name",
      type_material_name: "mt.name",
      manufacture_name: "mf.name",
      updated_at: "mv.updated_at",
    }

    if (queryParam.sort_by && sortMapping[queryParam.sort_by]) {
      const order =
        queryParam.sort_type?.toLowerCase() === "desc" ? "desc" : "asc"
      query = query.orderBy(sortMapping[queryParam.sort_by], order)
    }

    return query
  }
}
