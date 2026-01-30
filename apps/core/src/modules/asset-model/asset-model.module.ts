import { Context } from "hono"
import { AssetModelRepository } from "./asset-model.repository.js"
import {
  AddAssetModelRequest,
  AddAssetModelDTO,
  AddAssetModelWorkspaceDTO,
  AuditAssetModelDTO,
  EditAssetModelRequest,
  PartialAuditAssetModelDTO,
  EditAssetModelDTO,
  GetAssetModelsQueryParams,
  AssetModelsTemperatureCapacityDTO,
  AssetModelsTemperatureCapacityDTOUpdate,
  DonwloadTemplateQueryParams,
  ImportTemplateQueryParams,
  ImportAssetModelArrayRequest,
} from "./asset-model.schema.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { AssetModelTemplate, AssetModelExport } from "./asset-model.excel.js"
import moment from "moment"
import { AssetTypesTemperatureRepository } from "../asset-types-temperature/asset-types-temperature.repository.js"
import { collect, merge, pick } from "@smile-health/lib/utils.js"
import { UserRepository } from "../user/user.repository.js"
import { TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL } from "@/common/constants/assets.js"
import { TemperatureThresholdRepository } from "../temperature-threshold/temperature-threshold.repository.js"
import { AssetInventoryRepository } from "../asset-inventory/asset-inventory.repository.js"

export class AssetModelModule {
  constructor(
    private readonly repository: AssetModelRepository,
    private readonly assetTypesTemperatureRepo: AssetTypesTemperatureRepository,
    private readonly userRepo: UserRepository,
    private readonly temperatureThresholdRepo: TemperatureThresholdRepository,
    private readonly assetInventoryRepo: AssetInventoryRepository
  ) {}

  async create(c: Context, body: AddAssetModelRequest) {
    const { ...restRequest } = body
    const userId = Number(c.var.accountID)
    const currentDate = new Date()
    const promises: any[] = []

    const auditData: AuditAssetModelDTO = {
      created_by: userId,
      updated_by: userId,
      created_at: currentDate,
      updated_at: currentDate,
    }

    const assetModelData: AddAssetModelDTO = {
      name: restRequest.name,
      asset_type_id: restRequest.asset_type_id,
      manufacture_id: restRequest.manufacture_id,
      pqs_code_id: restRequest.asset_model_capacity?.pqs_code_id,
      ...auditData,
    }

    const assetModel = await this.repository.create(c, assetModelData)
    const assetTypesTemperature = await this.assetTypesTemperatureRepo.find(c, {
      asset_type_id: restRequest.asset_type_id,
    })

    promises.push(assetModel)

    const assetModelId = Number(assetModel.insertId)

    if (
      restRequest.asset_model_capacity?.capacities?.length !== undefined &&
      restRequest.asset_model_capacity.capacities.length > 0
    ) {
      for (const capacity of restRequest.asset_model_capacity.capacities) {
        const capacityData: AssetModelsTemperatureCapacityDTO = {
          asset_model_id: assetModelId,
          net_capacity: capacity.net_capacity,
          gross_capacity: capacity.gross_capacity,
          asset_type_temperature_id:
            capacity.id_temperature_threshold &&
            assetTypesTemperature.length > 0
              ? assetTypesTemperature.find(
                  (temp) =>
                    temp.asset_type_id === restRequest.asset_type_id &&
                    temp.temperature_threshold_id ===
                      capacity.id_temperature_threshold
                )?.id
              : null,
          ...auditData,
        }
        const { asset_type_temperature_id, ...base } = capacityData

        if (asset_type_temperature_id) {
          promises.push(
            this.repository.createAssetModelTemperatureCapacity(c, capacityData)
          )
        } else {
          promises.push(
            this.repository.createAssetModelNonTemperatureCapacity(c, base)
          )
        }
      }
    }

    await Promise.all(promises)

    return { id: assetModelId }
  }

  async update(c: Context, id: number, body: EditAssetModelRequest) {
    const { ...restRequest } = body
    const userId = Number(c.var.accountID)
    const currentDate = new Date()
    const promises: any[] = []

    const auditData: PartialAuditAssetModelDTO = {
      updated_by: userId,
      updated_at: currentDate,
    }

    const assetModelData: EditAssetModelDTO = {
      name: restRequest.name,
      asset_type_id: restRequest.asset_type_id,
      manufacture_id: restRequest.manufacture_id,
      ...auditData,
    }

    const assetTypesTemperature = await this.assetTypesTemperatureRepo.find(c, {
      asset_type_id: restRequest.asset_type_id,
    })

    if (
      restRequest.asset_model_capacity &&
      restRequest.asset_model_capacity.capacities &&
      restRequest.asset_model_capacity.capacities.length > 0
    ) {
      restRequest.asset_model_capacity.capacities.forEach((capacity) => {
        if (capacity.id) {
          const updateCapacityData: AssetModelsTemperatureCapacityDTOUpdate = {
            asset_model_id: id,
            net_capacity: capacity.net_capacity,
            gross_capacity: capacity.gross_capacity,
            asset_type_temperature_id:
              capacity.id_temperature_threshold &&
              assetTypesTemperature.length > 0
                ? assetTypesTemperature.find(
                    (temp) =>
                      temp.asset_type_id === restRequest.asset_type_id &&
                      temp.temperature_threshold_id ===
                        capacity.id_temperature_threshold
                  )?.id
                : null,
            ...auditData,
          }
          const { asset_type_temperature_id, ...base } = updateCapacityData

          if (asset_type_temperature_id) {
            promises.push(
              this.repository.updateAssetModelTemperatureCapacity(
                c,
                updateCapacityData,
                capacity.id
              )
            )
          } else {
            promises.push(
              this.repository.updateAssetModelNonTemperatureCapacity(
                c,
                base,
                capacity.id
              )
            )
          }
        } else {
          const capacityData: AssetModelsTemperatureCapacityDTO = {
            asset_model_id: id,
            net_capacity: capacity.net_capacity,
            gross_capacity: capacity.gross_capacity,
            asset_type_temperature_id:
              capacity.id_temperature_threshold &&
              assetTypesTemperature.length > 0
                ? assetTypesTemperature.find(
                    (temp) =>
                      temp.asset_type_id === restRequest.asset_type_id &&
                      temp.temperature_threshold_id ===
                        capacity.id_temperature_threshold
                  )?.id
                : null,
            created_by: userId,
            created_at: currentDate,
            ...auditData,
          }
          const { asset_type_temperature_id, ...base } = capacityData

          if (asset_type_temperature_id) {
            promises.push(
              this.repository.createAssetModelTemperatureCapacity(
                c,
                capacityData
              )
            )
          } else {
            promises.push(
              this.repository.createAssetModelNonTemperatureCapacity(c, base)
            )
          }
        }
      })
    }

    promises.push(this.repository.update(c, assetModelData, { id: id }))

    await Promise.all(promises)
  }

  async detail(c: Context, id: number) {
    const detail = await this.repository.getAssetModelById(c, id)

    const [
      user,
      capacityTemperature,
      netCapacitiesWHO,
      netCapacitiesNonTemperature,
      assetMonitoringDevices,
      assetInventories,
    ] = await Promise.all([
      this.userRepo.getByIDsMapped(c, [
        detail?.created_by ?? 0,
        detail?.updated_by ?? 0,
      ]),
      this.repository.getCapacityTemperatureByAssetModelId(c, [id]),
      detail?.pqs_code_id
        ? this.repository.getNetCapacityTemperatureWHOPqs(
            c,
            detail?.pqs_code_id ?? 0
          )
        : [],
      detail?.pqs_code_id === null
        ? this.repository.getCapacityNonTemperatureByAssetModelIds(c, [id])
        : [],
      this.repository.findAssetMonitoringDeviceByAssetModelId(c, id),
      this.assetInventoryRepo.findOne(c, { asset_model_id: id }),
    ])

    const relatedAsset = assetMonitoringDevices || assetInventories

    const capacityTemperatureWithCategory = capacityTemperature.map((item) => ({
      ...item,
      category: this.getCategory(
        item.min_temperature?.valueOf() ?? 0,
        item.max_temperature?.valueOf() ?? 0
      ),
    }))

    const netCapacitiesWHOWithCategory =
      netCapacitiesWHO.length > 0
        ? netCapacitiesWHO.map((item) => ({
            net_capacity: item.net_capacity,
            pqs_code: item.code,
            category: this.getCategory(
              item.min_temperature?.valueOf() ?? 0,
              item.max_temperature?.valueOf() ?? 0
            ),
          }))
        : []

    return {
      ...detail,
      is_related_asset: relatedAsset ? 1 : 0,
      pqs_code: netCapacitiesWHO.length > 0 ? netCapacitiesWHO[0]?.code : null,
      capacities:
        capacityTemperatureWithCategory.length > 0
          ? capacityTemperatureWithCategory
          : netCapacitiesNonTemperature,
      net_capacities_who: netCapacitiesWHOWithCategory ?? [],
      created_by: detail?.created_by
        ? (user[detail.created_by]?.[0] ?? {})
        : {},
      updated_by: detail?.updated_by
        ? (user[detail.updated_by]?.[0] ?? {})
        : {},
    }
  }

  async list(c: Context, params: GetAssetModelsQueryParams) {
    const { parentList, total } = await this.repository.getListAssetModel(
      c,
      params
    )

    if (parentList.length === 0) {
      return new PaginatedResponse(params, parentList)
    }

    const createdByIds = collect(parentList, "created_by")
    const updatedByIds = collect(parentList, "updated_by")
    const ids = collect(parentList, "id")

    const [users, netCapacityTemperature, netCapacitiesNonTemperature] =
      await Promise.all([
        this.userRepo.getByIDsMapped(
          c,
          merge(
            createdByIds.length > 0 ? createdByIds : [0],
            updatedByIds.length > 0 ? updatedByIds : [0]
          )
        ),
        this.repository.getCapacityTemperatureByAssetModelId(c, ids),
        this.repository.getCapacityNonTemperatureByAssetModelIds(c, ids),
      ])

    const capacityTemperatureWithCategory =
      netCapacityTemperature.length > 0
        ? netCapacityTemperature.map((item) => ({
            ...item,
            category: this.getCategory(
              item.min_temperature?.valueOf() ?? 0,
              item.max_temperature?.valueOf() ?? 0
            ),
          }))
        : []

    const result = parentList.map((item) => {
      const findCapacityTemperature = capacityTemperatureWithCategory.filter(
        (capacity) => capacity.asset_model_id === item.id
      )
      return {
        ...item,
        user_created_by: users[item.created_by ?? 0]?.[0] ?? {},
        user_updated_by: users[item.updated_by ?? 0]?.[0] ?? {},
        capacities:
          findCapacityTemperature.length > 0
            ? findCapacityTemperature
            : netCapacitiesNonTemperature.filter(
                (capacity) => capacity.asset_model_id === item.id
              ),
      }
    })

    return new PaginatedResponse(params, result, total)
  }

  async template(c: Context, param: DonwloadTemplateQueryParams) {
    const { type } = param
    const excelTemplate = new AssetModelTemplate()
    const title =
      type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITH_PQS
        ? c.var.t(
            "asset_model.template.template_import_model_asset_temperature_and_pqs"
          )
        : type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITHOUT_PQS
          ? c.var.t(
              "asset_model.template.template_import_model_asset_temperature_non_pqs"
            )
          : c.var.t(
              "asset_model.template.template_import_model_asset_non_temperature_and_non_pqs"
            )
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))

    const loadFiles =
      type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITH_PQS
        ? c.var.t(
            "asset_model.template.template_import_model_asset_temperature_and_pqs.file"
          )
        : type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITHOUT_PQS
          ? c.var.t(
              "asset_model.template.template_import_model_asset_temperature_non_pqs.file"
            )
          : c.var.t(
              "asset_model.template.template_import_model_asset_non_temperature_and_non_pqs.file"
            )

    await excelTemplate.loadFile(loadFiles)

    if (type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITH_PQS) {
      await Promise.all([
        excelTemplate.setManufactures(
          this.repository.getManufactureStreamData(c)
        ),
        excelTemplate.setAssetTypes(
          this.repository.getAssetTypeStreamData(c, 1)
        ),
        excelTemplate.setPqsCodes(
          this.repository.getPQSWithCapacitiesStream(c)
        ),
      ])
    } else if (type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.NON_CCE) {
      await Promise.all([
        excelTemplate.setManufactures(
          this.repository.getManufactureStreamData(c)
        ),
        excelTemplate.setAssetTypes(
          this.repository.getAssetTypeStreamData(c, 0)
        ),
      ])
    } else if (type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.IS_CCE_WITHOUT_PQS) {
      await Promise.all([
        excelTemplate.setManufactures(
          this.repository.getManufactureStreamData(c)
        ),
        excelTemplate.setAssetTypes(
          this.repository.getAssetTypeStreamData(c, 1)
        ),
      ])
    }

    return await excelTemplate.generate(title)
  }

  async export(c: Context, params: GetAssetModelsQueryParams) {
    const stream = await this.repository.getListAssetModelWithoutPaginate(
      c,
      params
    )

    const rows: (string | number | Date | null | undefined)[][] = []
    const timezone = c.req.header("Timezone") || "UTC"

    for await (const item of stream) {
      const row = [
        item.model_id,
        item.model_name,
        item.asset_type_id,
        item.asset_type_name,
        item.manufacture_id,
        item.manufacture_name,
        item.gross_capacity_1 ?? "-",
        item.nett_capacity_1 ?? "-",
        item.gross_capacity_2 ?? "-",
        item.nett_capacity_2 ?? "-",
        item.gross_capacity_3 ?? "-",
        item.nett_capacity_3 ?? "-",
        item.pqs_code ?? "-",
        item.capacity_nett_plus_5 ?? "-",
        item.gross_capacity_plus_5 ?? "-",
        item.capacity_nett_minus_20 ?? "-",
        item.gross_capacity_minus_20 ?? "-",
        item.capacity_nett_minus_86 ?? "-",
        item.gross_capacity_minus_86 ?? "-",
        item.updated_by_name ?? "-",
        item.date_updated
          ? moment(item.date_updated).tz(timezone).format("DD/MM/YYYY HH:mm")
          : "-",
      ]
      rows.push(row)
    }

    const columns = [
      {
        key: "model_id",
        header: c.var.t("asset_model.label.id"),
        width: 20,
      },
      {
        key: "model_name",
        header: c.var.t("asset_model.label.name"),
        width: 30,
      },
      {
        key: "asset_type_id",
        header: c.var.t("asset_model.label.asset_type_id"),
        width: 30,
      },
      {
        key: "asset_type_name",
        header: c.var.t("asset_model.label.asset_type_name"),
        width: 30,
      },
      {
        key: "manufacture_id",
        header: c.var.t("asset_model.label.manufacture_id"),
        width: 30,
      },
      {
        key: "manufacture_name",
        header: c.var.t("asset_model.label.manufacture_name"),
        width: 30,
      },
      {
        key: "gross_capacity_1",
        header: `${c.var.t("asset_model.label.gross_capacity", {
          value: "1",
        })}`,
        width: 30,
      },
      {
        key: "nett_capacity_1",
        header: `${c.var.t("asset_model.label.net_capacity", {
          value: "1",
        })}`,
        width: 30,
      },
      {
        key: "gross_capacity_2",
        header: `${c.var.t("asset_model.label.gross_capacity", {
          value: "2",
        })}`,
        width: 30,
      },
      {
        key: "nett_capacity_2",
        header: `${c.var.t("asset_model.label.net_capacity", {
          value: "2",
        })}`,
        width: 30,
      },
      {
        key: "gross_capacity_3",
        header: `${c.var.t("asset_model.label.gross_capacity", {
          value: "3",
        })}`,
        width: 30,
      },
      {
        key: "nett_capacity_3",
        header: `${c.var.t("asset_model.label.net_capacity", {
          value: "3",
        })}`,
        width: 30,
      },
      {
        key: "kode_pqs",
        header: c.var.t("asset_model.label.kode_pqs"),
        width: 30,
      },
      {
        key: "capacity_nett_plus_5",
        header: `${c.var.t("asset_model.label.capacity_nett_who")} +5`,
        width: 30,
      },
      {
        key: "gross_capacity_plus_5",
        header: `${c.var.t("asset_model.label.capacity_gross_who")} +5`,
        width: 30,
      },
      {
        key: "capacity_nett_minus_20",
        header: `${c.var.t("asset_model.label.capacity_nett_who")} -20`,
        width: 30,
      },
      {
        key: "gross_capacity_minus_20",
        header: `${c.var.t("asset_model.label.capacity_gross_who")} -20`,
        width: 30,
      },
      {
        key: "capacity_nett_minus_86",
        header: `${c.var.t("asset_model.label.capacity_nett_who")} -86`,
        width: 30,
      },
      {
        key: "gross_capacity_minus_86",
        header: `${c.var.t("asset_model.label.capacity_gross_who")} -86`,
        width: 30,
      },
      {
        key: "updated_by_name",
        header: c.var.t("asset_model.label.updated_by"),
        width: 30,
      },
      {
        key: "date_updated",
        header: c.var.t("asset_model.label.updated_at"),
        width: 30,
      },
    ]

    const sheet = c.var.t("asset_model.export.name")
    const excelTemplate = new AssetModelExport()
    const language = c.var.language || "en"
    await excelTemplate.initSheet(sheet)

    excelTemplate.setLanguage(language)
    excelTemplate.setTitle(c.var.t("asset_model.export.name"))
    excelTemplate.setTimezone(c.req.header("Timezone"))
    excelTemplate.setColumns(columns)
    await excelTemplate.addRows(sheet, rows)

    return excelTemplate.generate()
  }

  async import(
    c: Context,
    rows: ImportAssetModelArrayRequest[],
    params: ImportTemplateQueryParams
  ) {
    const temperatureThreshold =
      params.type === 1 || params.type === 2
        ? await this.temperatureThresholdRepo.find(c, {
            is_predefined: 1,
          })
        : []

    const mapping = [
      {
        key: "plus_5",
        id:
          temperatureThreshold.find(
            (t) => t.min_temperature === 2 && t.max_temperature === 8
          )?.id ?? null,
      },
      {
        key: "minus_20",
        id:
          temperatureThreshold.find(
            (t) => t.min_temperature === -25 && t.max_temperature === -15
          )?.id ?? null,
      },
      {
        key: "minus_86",
        id:
          temperatureThreshold.find(
            (t) => t.min_temperature === -86 && t.max_temperature === -40
          )?.id ?? null,
      },
    ]

    for (const row of rows) {
      const capacitiesTemperature = mapping
        .map(({ key, id }) => ({
          id_temperature_threshold: id,
          net_capacity: row[`net_capacity_${key}`],
          gross_capacity: row[`gross_capacity_${key}`],
        }))
        .filter((c) => c.net_capacity !== null && c.gross_capacity !== null)

      const capacitiesNonTemperature =
        params.type === TYPE_DOWNLOAD_TEMPLATE_ASSET_MODEL.NON_CCE
          ? [
              {
                id: null,
                id_temperature_threshold: null,
                net_capacity: row["net_capacity_1"],
                gross_capacity: row["gross_capacity_1"],
              },
              {
                id: null,
                id_temperature_threshold: null,
                net_capacity: row["net_capacity_2"],
                gross_capacity: row["gross_capacity_2"],
              },
              {
                id: null,
                id_temperature_threshold: null,
                net_capacity: row["net_capacity_3"],
                gross_capacity: row["gross_capacity_3"],
              },
            ].filter(
              (c) => c.net_capacity !== null && c.gross_capacity !== null
            )
          : []

      const allCapacities =
        capacitiesTemperature.length > 0
          ? capacitiesTemperature
          : capacitiesNonTemperature

      const payload = {
        name: row["name"],
        asset_type_id: row["asset_type_id"],
        manufacture_id: row["manufacture_id"],
        is_capacity:
          allCapacities.length > 0 ? (1 as 0 | 1 | null) : (0 as 0 | 1 | null),
        asset_model_capacity: {
          pqs_code_id: row["pqs_code_id"] ?? null,
          capacities: allCapacities.length > 0 ? allCapacities : undefined,
        },
      }

      await this.create(c, payload)
    }

    const response = this.messageResponse(
      `created, total ${rows.length} rows have been created`
    )
    return response
  }

  private async setUpdateProgramIds(
    c: Context,
    id: number,
    programIds: number[] | undefined
  ) {
    if (!programIds) return undefined

    const assetModelWorkspaces =
      await this.repository.getAssetModelWorkspaceByAssetModelId(c, id)

    if (assetModelWorkspaces.length === 0) return programIds

    const assetModelWorkspaceIds = assetModelWorkspaces.map(
      (item) => item.workspace_id
    )
    const result = programIds.filter(
      (val) => !assetModelWorkspaceIds.includes(val)
    )

    if (result.length === 0) return undefined

    return result
  }

  private setListFinalResponse(c: Context, parentData, allData) {
    const grouped = {}
    const order: number[] = []

    for (const item of parentData) {
      if (!grouped[item.id]) {
        grouped[item.id] = this.setMainResponse(c, item)
        order.push(item.id)
      }

      for (const subItem of allData) {
        if (subItem.program_id && subItem.id === item.id) {
          grouped[item.id].programs.push(this.setProgramResponse(subItem))
        }
      }
    }
    const result = order.map((id) => grouped[id])

    return result
  }

  private setDetailFinalResponse(c: Context, data) {
    const grouped = {}
    const order: number[] = []

    for (const item of data) {
      if (!grouped[item.id]) {
        grouped[item.id] = this.setMainResponse(c, item)
        order.push(item.id)
      }

      if (item.program_id) {
        grouped[item.id].programs.push(this.setProgramResponse(item))
      }
    }

    const result = order.map((id) => grouped[id])

    return result[0]
  }

  private setMainResponse(c: Context, item) {
    const response = {
      id: item.id,
      name: item.name,
      net_capacity: item.net_capacity,
      gross_capacity: item.gross_capacity,
      created_at: item.created_at,
      updated_at: item.updated_at,
      asset_type: {
        id: item.asset_type_id,
        name: item.asset_type_name,
        min_temperature: item.asset_type_min_temperature,
        max_temperature: item.asset_type_max_temperature,
      },
      manufacture: {
        id: item.manufacture_id,
        name: item.manufacture_name,
      },
      programs: [],
      user_created_by: {
        id: item.user_created_id,
        username: item.user_created_username,
        firstname: item.user_created_firstname,
        lastname: item.user_created_lastname,
        fullname: item.user_created_fullname,
      },
      user_updated_by: {
        id: item.user_updated_id,
        username: item.user_updated_username,
        firstname: item.user_updated_firstname,
        lastname: item.user_updated_lastname,
        fullname: item.user_updated_fullname,
      },
    }
    return response
  }

  private setProgramResponse(item) {
    const response = {
      id: item.program_id,
      key: item.program_key,
      name: item.program_name,
      config: item.program_config,
    }
    return response
  }

  private messageResponse(info: string) {
    return {
      success: true,
      message: `Data successfully ${info}`,
    }
  }

  private getCategory(min: number, max: number): number | null {
    if (min === 2 && max === 8) return 5
    if (min === -25 && max === -15) return -20
    if (min === -86 && max === -40) return -86
    return null
  }
}
