import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import moment from "moment"
import {
  AnnualCommitmentExport,
  AnnualCommitmentTemplate,
} from "./annual-commitment.excel.js"
import { AnnualCommitmentRepository } from "./annual-commitment.repository.js"
import {
  CreateAnnualCommitmentBodyRequest,
  GetAnnualCommitmentQueryParams,
  ImportRowRequestConverted,
  UpdatesAnnualCommitmentBodyRequest,
} from "./annual-commitment.schema.js"

export class AnnualCommitmentModule {
  constructor(private readonly repository: AnnualCommitmentRepository) {}

  async list(c: Context, params: GetAnnualCommitmentQueryParams) {
    const { all, grouped, total } = await this.repository.getListWithPagination(
      c,
      c.get("programId"),
      params
    )
    const result = this.setResponse(c, all, grouped)
    return new PaginatedResponse(params, result, total)
  }

  async detail(c: Context, id: number) {
    const { all, grouped } = await this.repository.getDetail(
      c,
      id,
      c.get("programId")
    )
    const result = this.setResponse(c, all, grouped)
    return result[0]
  }

  async export(c: Context, params: GetAnnualCommitmentQueryParams) {
    const excelTemplate = new AnnualCommitmentExport()
    const title = c.var.t("annual_commitment.export.name")
    const timezone = c.req.header("Timezone") ?? "Asia/Jakarta"
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)

    await excelTemplate.initSheet(title)

    excelTemplate.setColumns([
      {
        header: c.var.t("annual_commitment.label.id"),
        width: 15,
      },
      {
        header: c.var.t("annual_commitment.label.contract_number"),
        width: 50,
      },
      {
        header: c.var.t("annual_commitment.label.contract_start_date"),
        width: 20,
      },
      {
        header: c.var.t("annual_commitment.label.contract_end_date"),
        width: 20,
      },
      {
        header: c.var.t("annual_commitment.label.year"),
        width: 15,
      },
      {
        header: c.var.t("annual_commitment.label.vendor_name"),
        width: 50,
      },
      {
        header: c.var.t("annual_commitment.label.information"),
        width: 50,
      },
      {
        header: c.var.t("annual_commitment.label.delivery_type_name"),
        width: 15,
      },
      {
        header: c.var.t("annual_commitment.label.province_name"),
        width: 40,
      },
      {
        header: c.var.t("annual_commitment.label.material_name"),
        width: 50,
      },
      {
        header: c.var.t("annual_commitment.label.vial_quantity"),
        width: 15,
      },
      {
        header: c.var.t("annual_commitment.label.dose_quantity"),
        width: 15,
      },
      {
        header: c.var.t("annual_commitment.label.updated_by_name"),
        width: 50,
      },
      {
        header: c.var.t("annual_commitment.label.updated_at"),
        width: 20,
      },
    ])

    const list = await this.repository.getListWithoutPagination(
      c,
      c.get("programId"),
      params
    )
    if (list.length === 0) return await excelTemplate.generate()

    await excelTemplate.addRows(
      title,
      list.map((item) => ({
        id: item.id,
        contract_number: item.contract_number,
        contract_start_date: moment(item.contract_start_date)
          .tz(timezone)
          .format("YYYY-MM-DD HH:mm:ss"),
        contract_end_date: item.contract_end_date
          ? moment(item.contract_end_date)
              .tz(timezone)
              .format("YYYY-MM-DD HH:mm:ss")
          : "",
        year: item.year,
        vendor_name: item.vendor_name,
        information: item.information ?? "",
        delivery_type_name: item.delivery_type_name,
        province_name: item.province_name ?? "",
        material_name: item.material_name ?? "",
        vial_quantity: item.vial_quantity,
        dose_quantity: item.dose_quantity,
        updated_by_name: item.updated_by_name,
        updated_at: moment(item.updated_at)
          .tz(timezone)
          .format("YYYY-MM-DD HH:mm:ss"),
      }))
    )

    return await excelTemplate.generate()
  }

  async template(c: Context) {
    const excelTemplate = new AnnualCommitmentTemplate()
    const title = c.var.t("annual_commitment.template.name")

    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    await excelTemplate.loadFile(c.var.t("annual_commitment.template.file"))

    await Promise.all([
      excelTemplate.setContracts(
        this.repository.getContractStreamData(c, c.get("programId"))
      ),
      excelTemplate.setVendors(
        this.repository.getVendorStreamData(c, c.get("programId"))
      ),
      excelTemplate.setMaterials(
        this.repository.getMaterialStreamData(c, c.get("programId"))
      ),
    ])

    return await excelTemplate.generate(title)
  }

  async create(c: Context, body: CreateAnnualCommitmentBodyRequest) {
    const { items, ...commitmentData } = body
    const programId = c.get("programId")
    const userId = Number(c.var.userId)
    const now = new Date()
    const promises: unknown[] = []

    let contractId: number

    const contract = await this.repository.getContractIdByContractNumber(
      c,
      commitmentData.contract_number.trim()
    )

    if (!contract) {
      const contract = await this.repository.createContract(c, {
        contract_number: commitmentData.contract_number.trim(),
        created_at: now,
        updated_at: now,
        created_by: userId,
        updated_by: userId,
      })

      contractId = Number(contract.insertId)
    } else {
      contractId = contract.id
    }

    const commitment = await this.repository.createCommitment(c, {
      program_id: programId,
      contract_id: contractId,
      contract_start_date: new Date(
        this.nowFormatted(commitmentData.contract_start_date)
      ),
      contract_end_date: new Date(
        this.nowFormatted(commitmentData.contract_end_date)
      ),
      year: commitmentData.year,
      vendor_id: commitmentData.vendor_id,
      information: commitmentData.information ?? null,
      created_at: now,
      updated_at: now,
      created_by: userId,
      updated_by: userId,
    })

    promises.push(commitment)

    const commitmentId = Number(commitment.insertId)

    // get materials
    const materials = await this.repository.getMaterials(c, programId)

    if (items && items.length > 0) {
      const mappedItems = items.map((item) => ({
        commitment_id: commitmentId,
        delivery_type_id: item.province_id ? 1 : 3,
        material_id: item.material_id,
        parent_material_id: this.getValue(
          materials,
          "id",
          item.material_id,
          "parent_id"
        ),
        province_id: item.province_id ?? null,
        vial_quantity: item.vial_quantity,
        dose_quantity: item.dose_quantity,
        created_at: now,
        updated_at: now,
        created_by: userId,
        updated_by: userId,
      }))

      promises.push(this.repository.createCommitmentItems(c, mappedItems))
    }

    await Promise.all(promises)

    return { id: commitmentId }
  }

  async update(
    c: Context,
    id: number,
    body: UpdatesAnnualCommitmentBodyRequest
  ) {
    const { items, ...commitmentData } = body
    const programId = c.get("programId")
    const userId = Number(c.var.userId)
    const now = new Date()
    const promises: unknown[] = []

    let contractId: number

    const contract = await this.repository.getContractIdByContractNumber(
      c,
      commitmentData.contract_number.trim()
    )

    if (!contract) {
      const contract = await this.repository.createContract(c, {
        contract_number: commitmentData.contract_number.trim(),
        created_at: now,
        updated_at: now,
        created_by: userId,
        updated_by: userId,
      })

      contractId = Number(contract.insertId)
    } else {
      contractId = contract.id
    }

    promises.push(
      this.repository.updateCommitmentById(c, id, programId, {
        contract_id: contractId,
        contract_start_date: new Date(
          this.nowFormatted(commitmentData.contract_start_date)
        ),
        contract_end_date: new Date(
          this.nowFormatted(commitmentData.contract_end_date)
        ),
        year: commitmentData.year,
        vendor_id: commitmentData.vendor_id,
        information: commitmentData.information ?? null,
        updated_at: now,
        updated_by: userId,
      })
    )

    // get materials
    const materials = await this.repository.getMaterials(c, programId)

    // define delete data
    const deleteData = {
      deleted_at: now,
      deleted_by: userId,
    }

    if (items && items.length > 0) {
      // separate between new item and exiting item
      const { newItems, updatedItems } = items.reduce(
        (acc, item) => {
          if (item.id) {
            acc.updatedItems.push(item)
          } else {
            acc.newItems.push(item)
          }
          return acc
        },
        { newItems: [] as typeof items, updatedItems: [] as typeof items }
      )

      if (updatedItems.length > 0) {
        // update existing item
        const mappedUpdatedItems = updatedItems.map((item) => ({
          item_id: item.id,
          province_id: item.province_id ?? null,
          vial_quantity: item.vial_quantity,
          dose_quantity: item.dose_quantity,
          updated_at: now,
          updated_by: userId,
        }))

        for (const mappedUpdatedItem of mappedUpdatedItems) {
          const { item_id, ...otherItem } = mappedUpdatedItem

          promises.push(
            this.repository.updateCommitmentItemByCommitmentId(
              c,
              Number(item_id),
              id,
              otherItem
            )
          )
        }

        // soft delete existing item has been removed
        const usedItemIds = mappedUpdatedItems.map((item) =>
          Number(item.item_id)
        )
        promises.push(
          this.repository.deleteCommitmentItemByIdsAndCommitmentId(
            c,
            usedItemIds,
            id,
            deleteData
          )
        )
      } else {
        // soft delete all existing item because no one selected
        promises.push(
          this.repository.deleteCommitmentItemByCommitmentId(c, id, deleteData)
        )
      }

      // save new item
      if (newItems.length > 0) {
        const mappedNewItems = newItems.map((item) => ({
          commitment_id: id,
          delivery_type_id: item.province_id ? 1 : 3,
          material_id: item.material_id,
          parent_material_id: this.getValue(
            materials,
            "id",
            item.material_id,
            "parent_id"
          ),
          province_id: item.province_id ?? null,
          vial_quantity: item.vial_quantity,
          dose_quantity: item.dose_quantity,
          created_at: now,
          updated_at: now,
          created_by: userId,
          updated_by: userId,
        }))

        promises.push(this.repository.createCommitmentItems(c, mappedNewItems))
      }
    }

    // soft delete existing when all items has been removed
    if (!items || (items && items.length === 0)) {
      promises.push(
        this.repository.deleteCommitmentItemByCommitmentId(c, id, deleteData)
      )
    }

    await Promise.all(promises)

    return
  }

  async import(c: Context, rows: ImportRowRequestConverted[]) {
    const userId = Number(c.var.userId)
    const now = new Date()
    const promises: unknown[] = []

    // grouping by contract number
    const dataGrouped: any = await this.importDataGrouped(c, rows)

    for (const data of dataGrouped) {
      const { items, ...commitmentData } = data

      const { contract_number, ...otherCommitment } = commitmentData

      // get contract id
      let contractId: number

      const contract = await this.repository.getContractIdByContractNumber(
        c,
        contract_number.trim()
      )

      if (!contract) {
        const contract = await this.repository.createContract(c, {
          contract_number: contract_number.trim(),
          created_at: now,
          updated_at: now,
          created_by: userId,
          updated_by: userId,
        })

        contractId = Number(contract.insertId)
      } else {
        contractId = contract.id
      }

      // save commitment
      const rebuildCommitment = {
        contract_id: contractId,
        ...otherCommitment,
      }

      const commitment = await this.repository.createCommitment(
        c,
        rebuildCommitment
      )

      promises.push(commitment)

      const commitmentId = Number(commitment.insertId)

      // save commitment item
      if (items && items.length > 0) {
        const mappedItems = items.map((item) => ({
          commitment_id: commitmentId,
          ...item,
        }))

        promises.push(this.repository.createCommitmentItems(c, mappedItems))
      }
    }

    await Promise.all(promises)

    const response = this.messageResponse(
      `created, total ${dataGrouped.length} commitments have been created`
    )
    return response
  }

  private setResponse(c: Context, all, grouped) {
    const result = grouped.map((base) => {
      const filteredItems = all.filter(
        (item) => item.commitment_item_id && Number(item.id) === Number(base.id)
      )

      return {
        id: base.id,
        year: base.year,
        contract_start_date: base.contract_start_date,
        contract_end_date: base.contract_end_date,
        information: base.information,
        updated_at: base.updated_at,
        contract: {
          id: base.contract_id,
          number: base.contract_number,
        },
        vendor: {
          id: base.vendor_id,
          name: base.vendor_name,
        },
        user_updated_by: {
          id: base.updated_by_id,
          fullname: base.updated_by_name,
        },
        items:
          filteredItems.length === 0
            ? null
            : filteredItems.map((item) => ({
                id: item.commitment_item_id,
                vial_quantity: item.vial_quantity,
                dose_quantity: item.dose_quantity,
                delivery_type: {
                  id: item.delivery_type_id,
                  name: item.delivery_type_name,
                },
                material: {
                  id: item.material_id,
                  parent_id: item.parent_material_id,
                  name: item.material_name,
                },
                province: item.province_id
                  ? {
                      id: item.province_id,
                      name: item.province_name,
                    }
                  : null,
              })),
      }
    })

    return result
  }

  private getValue(
    dataSource: any[],
    filterValue: string,
    comparisonValue: any,
    returnValue: string
  ) {
    if (!comparisonValue) return null

    const result =
      dataSource.find((data) => data[filterValue] === comparisonValue)?.[
        returnValue
      ] ?? null

    return result
  }

  private nowFormatted(contractDate: Date) {
    const pad = (n: number) => String(n).padStart(2, "0")

    const YYYY = contractDate.getFullYear()
    const MM = pad(contractDate.getMonth() + 1)
    const DD = pad(contractDate.getDate())

    const hh = pad(contractDate.getHours())
    const mm = pad(contractDate.getMinutes())
    const ss = pad(contractDate.getSeconds())

    return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`
  }

  private async importDataGrouped(
    c: Context,
    data: ImportRowRequestConverted[]
  ) {
    const programId = c.get("programId")
    const userId = Number(c.var.userId)
    const now = new Date()

    // define auditData
    const auditData = {
      created_at: now,
      updated_at: now,
      created_by: userId,
      updated_by: userId,
    }

    // get materials
    const materials = await this.repository.getMaterials(c, programId)

    const grouped = Object.values(
      data.reduce((acc, row) => {
        if (!acc[row.contract_number]) {
          acc[row.contract_number] = {
            program_id: programId,
            contract_number: row.contract_number,
            contract_start_date: row.contract_start_date,
            contract_end_date: row.contract_end_date,
            year: row.year,
            vendor_id: row.vendor_id,
            information: row.information ?? null,
            ...auditData,
            items: [],
          }
        }

        acc[row.contract_number].items.push({
          delivery_type_id: row.province_id ? 1 : 3,
          province_id: row.province_id ?? null,
          material_id: row.material_id,
          parent_material_id: this.getValue(
            materials,
            "id",
            row.material_id,
            "parent_id"
          ),
          vial_quantity: row.vial_quantity,
          dose_quantity:
            row.vial_quantity *
            this.getValue(
              materials,
              "id",
              row.material_id,
              "consumption_unit_per_distribution_unit"
            ),
          ...auditData,
        })

        return acc
      }, {})
    )

    return grouped
  }

  private messageResponse(info: string) {
    return {
      success: true,
      message: `Data successfully ${info}`,
    }
  }
}
