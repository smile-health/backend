import { ENTITY_TAG } from "@/common/constants/entity.js"
import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { Context } from "hono"
import { sql } from "kysely"
import {
  CreateCommitmentDTO,
  CreateCommitmentItemDTO,
  CreateContractDTO,
  DeleteAuditDTO,
  GetAnnualCommitmentQueryParams,
  UpdateCommitmentDTO,
  UpdateCommitmentItemDTO,
} from "./annual-commitment.schema.js"

export class AnnualCommitmentRepository {
  getBase(c: Context, programId: number) {
    let queries = c.var.trx
      .selectFrom("ws_commitments as wcm")
      .leftJoin("ws_contracts as wct", (join) =>
        join.onRef("wct.id", "=", "wcm.contract_id")
      )
      .leftJoin("ws_entities as we", (join) =>
        join.onRef("we.id", "=", "wcm.vendor_id")
      )
      .leftJoin("ws_users as wuu", (join) =>
        join.onRef("wuu.id", "=", "wcm.updated_by")
      )
      .leftJoin("ws_commitment_items as wci", (join) =>
        join.onRef("wcm.id", "=", "wci.commitment_id")
      )
      .leftJoin("ws_materials as wm", (join) =>
        join.onRef("wm.id", "=", "wci.material_id")
      )
      .leftJoin("locations as l", (join) =>
        join.onRef("l.id", "=", "wci.province_id")
      )

    queries = queries
      .where("wcm.program_id", "=", programId)
      .where("wcm.deleted_at", "is", null)
      .where("wci.deleted_at", "is", null)

    return queries
  }

  selectData(language: string, queries) {
    return queries.select([
      "wcm.id",
      "wcm.contract_id",
      "wct.contract_number",
      "wcm.contract_start_date",
      "wcm.contract_end_date",
      "wcm.year",
      "wcm.vendor_id",
      "we.name as vendor_name",
      "wcm.information",
      "wcm.updated_at",
      "wcm.updated_by as updated_by_id",
      sql<string>`TRIM(CONCAT_WS(' ',COALESCE(CAST(${sql.ref("wuu.firstname")} AS CHAR), ''),COALESCE(CAST(${sql.ref("wuu.lastname")} AS CHAR), '')))`.as(
        "updated_by_name"
      ),
      "wci.id as commitment_item_id",
      "wci.delivery_type_id",
      (eb) =>
        eb
          .case()
          .when(eb("wci.delivery_type_id", "=", 1))
          .then(
            eb
              .case()
              .when(eb(eb.val(language), "=", eb.val("en")))
              .then("Allocation")
              .else("Alokasi")
              .end()
          )
          .else("Buffer")
          .end()
          .as("delivery_type_name"),
      "wci.province_id",
      "l.name as province_name",
      "wci.material_id",
      "wci.parent_material_id",
      "wm.name as material_name",
      "wci.vial_quantity",
      "wci.dose_quantity",
    ])
  }

  getList(
    c: Context,
    programId: number,
    params: GetAnnualCommitmentQueryParams
  ) {
    const {
      keyword,
      contract_number_id,
      year,
      material_id,
      supplier_id,
      province_id,
    } = params

    const { roleId, entityId } = c.var

    let queries = this.getBase(c, programId)

    if (keyword) {
      const contracts = this.getContractsByPartialContractNumber(c, keyword)

      if (contract_number_id) {
        queries = queries.where((eb) =>
          eb.or([
            eb("wcm.contract_id", "=", contract_number_id),
            eb("wcm.contract_id", "in", contracts),
          ])
        )
      } else {
        queries = queries.where("wcm.contract_id", "in", contracts)
      }
    } else {
      if (contract_number_id) {
        queries = queries.where("wcm.contract_id", "=", contract_number_id)
      }
    }

    if (year) {
      queries = queries.where("wcm.year", "=", year)
    }

    if (roleId === USER_ROLE.MANUFACTURE) {
      queries = queries.where("wcm.vendor_id", "=", Number(entityId))
    } else {
      if (supplier_id) {
        queries = queries.where("wcm.vendor_id", "=", supplier_id)
      }
    }

    if (material_id) {
      const filterMaterial = c.var.trx
        .selectFrom("ws_commitment_items as nwci")
        .select("nwci.commitment_id")
        .where("nwci.material_id", "=", material_id)

      queries = queries.where("wcm.id", "in", filterMaterial)
    }

    if (province_id) {
      const filterMaterial = c.var.trx
        .selectFrom("ws_commitment_items as nwci")
        .select("nwci.commitment_id")
        .where("nwci.province_id", "=", province_id)

      queries = queries.where("wcm.id", "in", filterMaterial)
    }

    return queries
  }

  async getDetail(c: Context, id: number, programId: number) {
    const language = c.var.language.toLocaleLowerCase()

    let queries = this.getBase(c, programId)

    queries = queries.where("wcm.id", "=", id)

    const selectData = this.selectData(language, queries)

    const groupedSelectData = selectData.groupBy("wcm.id")

    const [allList, groupedList] = await Promise.all([
      selectData.execute(),
      groupedSelectData.execute(),
    ])

    return {
      all: allList,
      grouped: groupedList,
    }
  }

  async getListWithPagination(
    c: Context,
    programId: number,
    params: GetAnnualCommitmentQueryParams
  ) {
    const language = c.var.language.toLocaleLowerCase()

    const { page, paginate, sort_by, sort_type } = params
    const offset = (page - 1) * paginate

    let sortBy
    let sortType

    if (sort_by && sort_type) {
      sortBy = sort_by
      sortType = sort_type
    } else {
      sortBy = "updated_at"
      sortType = "desc"
    }

    const queries = this.getList(c, programId, params)

    const selectData = this.selectData(language, queries)

    const groupedSelectData = selectData.groupBy("wcm.id")

    const grouped = groupedSelectData.as("grouped")

    const [allList, groupedList, totalList] = await Promise.all([
      selectData.execute(),
      groupedSelectData
        .orderBy(`wcm.${sortBy}`, sortType)
        .limit(paginate)
        .offset(offset)
        .execute(),
      c.var.trx
        .selectFrom(grouped)
        .select((eb) => eb.fn.countAll().as("total"))
        .executeTakeFirst(),
    ])

    return {
      all: allList,
      grouped: groupedList,
      total: Number(totalList?.total) || 0,
    }
  }

  async getListWithoutPagination(
    c: Context,
    programId: number,
    params: GetAnnualCommitmentQueryParams
  ) {
    const language = c.var.language.toLocaleLowerCase()

    const { sort_by, sort_type } = params

    let sortBy
    let sortType

    if (sort_by && sort_type) {
      sortBy = sort_by
      sortType = sort_type
    } else {
      sortBy = "updated_at"
      sortType = "desc"
    }

    const queries = this.getList(c, programId, params)

    const selectData = this.selectData(language, queries)

    const [results] = await Promise.all([
      selectData.orderBy(`wcm.${sortBy}`, sortType).execute(),
    ])

    return results
  }

  async getAnnualCommitmentIdById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_commitments")
      .select(["id", "vendor_id", "deleted_at"])
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }

  async getCommitments(c: Context, programId: number) {
    return await c.var.trx
      .selectFrom("ws_commitments")
      .select(["id", "contract_id", "program_id", "deleted_at"])
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getContracts(c: Context) {
    return await c.var.trx
      .selectFrom("ws_contracts")
      .select(["id", "contract_number"])
      .where("deleted_at", "is", null)
      .execute()
  }

  async getVendors(c: Context, programId: number) {
    return await c.var.trx
      .selectFrom("ws_entities")
      .select(["id"])
      .where("entity_tag_id", "=", ENTITY_TAG.MAIN_SUPPLIER)
      .where("is_vendor", "=", 1)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getCommitmentItems(c: Context) {
    return await c.var.trx
      .selectFrom("ws_commitment_items")
      .select([
        "id",
        "commitment_id",
        "delivery_type_id",
        "province_id",
        "material_id",
        "deleted_at",
      ])
      .where("deleted_at", "is", null)
      .execute()
  }

  async getProvinces(c: Context) {
    return await c.var.trx
      .selectFrom("locations")
      .select(["id"])
      .where("level", "=", 0)
      .where("parent_id", "is", null)
      .execute()
  }

  async getMaterials(c: Context, programId: number) {
    return await c.var.trx
      .selectFrom("ws_materials")
      .select(["id", "parent_id", "consumption_unit_per_distribution_unit"])
      .where("program_id", "=", programId)
      .where("material_level_id", "=", KFA_LEVEL_ID.VARIANT)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getContractIdByContractNumber(c: Context, contractNumber: string) {
    return await c.var.trx
      .selectFrom("ws_contracts")
      .select(["id"])
      .where("contract_number", "=", contractNumber)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  getContractStreamData(c: Context, programId: number) {
    return c.var.trx
      .selectFrom("ws_contracts as wct")
      .leftJoin("ws_commitments as wcm", (join) =>
        join
          .onRef("wct.id", "=", "wcm.contract_id")
          .on("wcm.program_id", "=", programId)
      )
      .select(["wct.id", "wct.contract_number"])
      .where("wcm.id", "is", null)
      .where("wct.deleted_at", "is", null)
      .orderBy("wct.id")
      .stream()
  }

  getVendorStreamData(c: Context, programId: number) {
    const { roleId, entityId } = c.var

    return c.var.trx
      .selectFrom("ws_entities")
      .select(["id", "name"])
      .where("entity_tag_id", "=", ENTITY_TAG.MAIN_SUPPLIER)
      .where("is_vendor", "=", 1)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .$if(roleId === USER_ROLE.MANUFACTURE, (b) =>
        b.where("id", "=", Number(entityId))
      )
      .orderBy("id")
      .stream()
  }

  getMaterialStreamData(c: Context, programId: number) {
    return c.var.trx
      .selectFrom("ws_materials")
      .select(["id", "name"])
      .where("program_id", "=", programId)
      .where("material_level_id", "=", KFA_LEVEL_ID.VARIANT)
      .where("deleted_at", "is", null)
      .orderBy("id")
      .stream()
  }

  async createContract(c: Context, req: CreateContractDTO) {
    return await c.var.trx
      .insertInto("ws_contracts")
      .values(req)
      .executeTakeFirst()
  }

  async createCommitment(c: Context, req: CreateCommitmentDTO) {
    return await c.var.trx
      .insertInto("ws_commitments")
      .values(req)
      .executeTakeFirst()
  }

  async createCommitmentItems(c: Context, req: CreateCommitmentItemDTO[]) {
    return await c.var.trx
      .insertInto("ws_commitment_items")
      .values(req)
      .execute()
  }

  async updateCommitmentById(
    c: Context,
    id: number,
    programId: number,
    req: UpdateCommitmentDTO
  ) {
    return await c.var.trx
      .updateTable("ws_commitments")
      .set(req)
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async updateCommitmentItemByCommitmentId(
    c: Context,
    id: number,
    commitmentId: number,
    req: UpdateCommitmentItemDTO
  ) {
    return await c.var.trx
      .updateTable("ws_commitment_items")
      .set(req)
      .where("id", "=", id)
      .where("commitment_id", "=", commitmentId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async deleteCommitmentItemByCommitmentId(
    c: Context,
    commitmentId: number,
    req: DeleteAuditDTO
  ) {
    return await c.var.trx
      .updateTable("ws_commitment_items")
      .set(req)
      .where("commitment_id", "=", commitmentId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async deleteCommitmentItemByIdsAndCommitmentId(
    c: Context,
    ids: number[],
    commitmentId: number,
    req: DeleteAuditDTO
  ) {
    return await c.var.trx
      .updateTable("ws_commitment_items")
      .set(req)
      .where("id", "not in", ids)
      .where("commitment_id", "=", commitmentId)
      .where("deleted_at", "is", null)
      .execute()
  }

  getContractsByPartialContractNumber(c: Context, contractNumber: string) {
    return c.var.trx
      .selectFrom("ws_contracts")
      .select(["id"])
      .where("contract_number", "like", `%${contractNumber}%`)
      .where("deleted_at", "is", null)
  }
}
