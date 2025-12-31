import { STATUS } from "@/common/constants/general.js"
import { NotFoundError, ValidationError } from "@smile/lib/error.js"
import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect, merge, pick } from "@smile/lib/utils.js"
import { Context } from "hono"
import path from "path"
import { UserRepository } from "../user/user.repository.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { ManufactureTemplateXlsx } from "./manufacture.excel.js"
import { ManufacturePublisher } from "./manufacture.publisher.js"
import { ManufactureRepository } from "./manufacture.repository.js"
import {
  ManufactureCreateRequestDTO,
  ManufactureDetailRequestDTO,
  ManufactureImportRequestDTO,
  ManufacturePaginatedRequestDTO,
  ManufactureUpdateRequestDTO,
} from "./manufacture.schema.js"

export class ManufactureModule {
  constructor(
    private readonly repo: ManufactureRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly userRepo: UserRepository,
    private readonly manufacturePublisher: ManufacturePublisher
  ) {}

  async #manageWorkspaces(
    c: Context,
    manufactureId: number,
    workspaceIds: number[] | undefined
  ) {
    const dataWorkspaces = (workspaceIds ?? []).map((workspace_id) => ({
      manufacture_id: manufactureId,
      workspace_id,
    }))

    await this.workspaceRepo.attachWithManufactureId(
      c,
      manufactureId,
      dataWorkspaces
    )
  }

  #getStatusLabel(status: number): string {
    switch (status) {
      case STATUS.ACTIVE:
        return "Active"
      case STATUS.INACTIVE:
        return "Inactive"
      default:
        return "-"
    }
  }

  async create(c: Context, data: ManufactureCreateRequestDTO) {
    const { program_ids, ...createData } = data

    createData.status = STATUS.ACTIVE
    createData.created_by = c.var.accountID
    createData.updated_by = c.var.accountID

    const manufacture = await this.repo.create(c, createData)
    const manufactureId = Number(manufacture.insertId)

    await this.#manageWorkspaces(c, manufactureId, program_ids)

    await this.manufacturePublisher.processCreate(c, manufactureId, data)

    return this.detail(c, { id: manufactureId })
  }

  async list(c: Context, params: ManufacturePaginatedRequestDTO) {
    params.isPaginate = true
    params.offset = (params.page - 1) * params.paginate

    const { data, total } = await this.repo.findAll(c, params)
    if (!data.length) return new PaginatedResponse(params)

    const manufactureIds = collect(data, "id")
    const typeIds = collect(data, "type")
    const createdByIds = collect(data, "created_by")
    const updatedByIds = collect(data, "updated_by")

    const [programs, types, users] = await Promise.all([
      this.workspaceRepo.getByFromMappedWorkspace(
        c,
        "manufacture",
        manufactureIds
      ),
      this.repo.findAndGroupByTypeID(c, typeIds),
      this.userRepo.getByIDsMapped(c, merge(createdByIds, updatedByIds)),
    ])

    const manufactures = data.map((el) => ({
      ...el,
      programs: programs[el.id] ?? [],
      manufacture_type: el.type
        ? {
            ...(types[el.type] as { id: number; name: string }),
            name: c.var.t(`manufacture.type.${el.type}`),
          }
        : {},
      user_created_by: users[el.created_by ?? 0]?.[0] ?? {},
      user_updated_by: users[el.updated_by ?? 0]?.[0] ?? {},
    }))

    return new PaginatedResponse(params, manufactures, total)
  }

  async detail(c: Context, id: ManufactureDetailRequestDTO) {
    const manufacture = await this.repo.findById(c, id)
    if (!manufacture)
      throw new NotFoundError(
        c.var.t("validator.not_exist", { field: "manufacture" })
      )
    if (manufacture.deleted_at)
      throw new ValidationError(
        c.var.t("validator.delete", { field: "manufacture" })
      )

    const [programs, type, userCreatedBy, userUpdatedBy] = await Promise.all([
      this.workspaceRepo.getByFromMappedWorkspace(c, "manufacture", [
        manufacture.id,
      ]),
      this.repo.findByTypeID(c, manufacture.type),
      this.userRepo.findById(c, manufacture.created_by ?? 0),
      this.userRepo.findById(c, manufacture.updated_by ?? 0),
    ])

    return {
      ...manufacture,
      programs: programs[manufacture.id] ?? [],
      manufacture_type: type
        ? {
            ...type,
            name: c.var.t(`manufacture.type.${type.id}`),
          }
        : undefined,
      user_created_by: pick(userCreatedBy, [
        "id",
        "username",
        "firstname",
        "lastname",
      ]),
      user_updated_by: pick(userUpdatedBy, [
        "id",
        "username",
        "firstname",
        "lastname",
      ]),
    }
  }

  async update(
    c: Context,
    data: ManufactureUpdateRequestDTO,
    id: ManufactureDetailRequestDTO
  ) {
    const { program_ids, ...updateData } = data

    updateData.updated_by = c.var.accountID

    const manufacture = await this.repo.findById(c, id)
    if (!manufacture) throw new NotFoundError("Manufacture not found.")

    await this.repo.update(c, updateData, id)

    await this.#manageWorkspaces(c, manufacture.id, program_ids)

    await this.manufacturePublisher.processUpdate(c, manufacture.id, data)

    return this.detail(c, id)
  }

  async delete(c: Context, id: ManufactureDetailRequestDTO) {
    const manufacture = await this.repo.findById(c, id)
    if (!manufacture) throw new NotFoundError("Manufacture not found.")
    if (manufacture.deleted_at)
      throw new ValidationError("Manufacture id has been deleted")

    await this.workspaceRepo.deleteDynamicById(
      c,
      "manufacture_workspaces",
      "manufacture_workspaces.manufacture_id",
      manufacture.id
    )

    await this.repo.delete(c, id)
  }

  async getManufactureTypes(c: Context) {
    const types = await this.repo.findAllTypes(c)

    const transformedData = types.map((item) => ({
      ...item,
      name: c.var.t(`manufacture.type.${item.id}`),
    }))

    return transformedData
  }

  async exportExcel(c: Context, params: ManufacturePaginatedRequestDTO) {
    params.isPaginate = false

    const title = c.var.t("manufacture.export.title")
    const timezone = c.req.header("Timezone")
    const columns = [
      {
        header: c.var.t("manufacture.export.id"),
        width: 10,
      },
      {
        header: c.var.t("manufacture.export.name"),
        width: 40,
      },
      {
        header: c.var.t("manufacture.export.type"),
        width: 20,
      },
      {
        header: c.var.t("manufacture.export.status"),
        width: 20,
      },
      {
        header: c.var.t("manufacture.export.updated_by"),
        width: 20,
      },
      {
        header: c.var.t("manufacture.export.program"),
        width: 40,
      },
    ]

    const excelTemplate = new BaseTemplate()
    await excelTemplate.initSheet(title)
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)
    excelTemplate.setColumns(columns)

    const { data } = await this.repo.findAll(c, params)
    if (!data.length) return await excelTemplate.generate()

    const manufactureIds = collect(data, "id")
    const typeIds = collect(data, "type")
    const createdByIds = collect(data, "created_by")
    const updatedByIds = collect(data, "updated_by")

    const [programs, types, users] = await Promise.all([
      this.workspaceRepo.getByFromMappedWorkspace(
        c,
        "manufacture",
        manufactureIds
      ),
      this.repo.findAndGroupByTypeID(c, typeIds),
      this.userRepo.getByIDsMapped(c, merge(createdByIds, updatedByIds)),
    ])

    const setRows = data.map((el) => ({
      id: el.id,
      name: el.name,
      type:
        typeof types[el.type ?? 0] === "object" && types[el.type ?? 0] !== null
          ? c.var.t(
              `manufacture.type.${(types[el.type ?? 0] as { id: number; name: string }).id}`
            )
          : "-",
      status: this.#getStatusLabel(Number(el.status)),
      user_updated_by: users[el.updated_by ?? 0]?.[0]?.firstname ?? "-",
      programs: programs[el.id]?.map((p) => p.name).join(", ") ?? "-",
    }))

    await excelTemplate.addRows(title, setRows)

    return await excelTemplate.generate()
  }

  async templateExcel(c: Context) {
    const language = c.var.language
    const filename = `manufacture_${language}.xlsx`
    const templatePath = path.resolve(
      "public",
      "templates",
      "manufacture",
      filename
    )

    const excelTemplate = new ManufactureTemplateXlsx(PROCESSOR.XLSXPOPULATE)
    await excelTemplate.loadFromFile(templatePath)
    await Promise.allSettled([
      excelTemplate.populateMasterData(
        c.var.t("manufacture.template.sheet_list_manufacture_type"),
        await this.repo.findAllTypesStream(c)
      ),
      excelTemplate.populateMasterData(
        c.var.t("manufacture.template.sheet_list_program"),
        this.workspaceRepo.getStreamData(c)
      ),
    ])

    return await excelTemplate.generate(
      `Template - Import ${c.var.t("manufacture.template.title")}`
    )
  }

  async importExcel(c: Context, rows: ManufactureImportRequestDTO[]) {
    for (const row of rows) {
      const createData = {
        name: row.name,
        type: row.type,
        description: row.description,
        contact_name: row.contact_name,
        phone_number: row.phone_number,
        email: row.email,
        address: row.address,
        status: STATUS.ACTIVE,
        created_by: Number(c.var.accountID),
        updated_by: Number(c.var.accountID),
      }

      const manufacture = await this.repo.create(c, createData)
      const manufactureId = Number(manufacture.insertId)

      if (Array.isArray(row.program_id) && row.program_id.length > 0) {
        await this.#manageWorkspaces(c, manufactureId, row.program_id)
      }
    }

    return rows.length
  }
}
