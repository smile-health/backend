import {
  ASSET_CLASSIFICATION,
  TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE,
} from "@/common/constants/assets.js"
import { NotFoundError } from "@smile/lib/error.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { collect, merge, pick } from "@smile/lib/utils.js"
import { Context } from "hono"
import moment from "moment"
import { AssetTypesClassificationRepository } from "../asset-types-classification/asset-types-classification.repository.js"
import { AssetTypesTemperatureRepository } from "../asset-types-temperature/asset-types-temperature.repository.js"
import { IntegrationRepository } from "../integration/integration.repository.js"
import { UserRepository } from "../user/user.repository.js"
import { AssetTypeExport, AssetTypeTemplate } from "./asset-type.excel.js"
import { AssetTypeRepository } from "./asset-type.repository.js"
import {
  AddAssetTypeDTO,
  AddAssetTypeImport,
  AddAssetTypeRequest,
  AuditAssetTypeDTO,
  DownloadTemplateQueryParams,
  EditAssetTypeDTO,
  EditAssetTypeRequest,
  GetAssetTypesQueryParams,
  ImportTemplateQueryParams,
  PartialAuditAssetTypeDTO,
  RowType,
  toArrayInt,
} from "./asset-type.schema.js"
import { AssetModelRepository } from "../asset-model/asset-model.repository.js"

export class AssetTypeModule {
  constructor(
    private readonly repository: AssetTypeRepository,
    private readonly assetTypesTemperatureRepo: AssetTypesTemperatureRepository,
    private readonly userRepo: UserRepository,
    private readonly assetTypesClassificationRepo: AssetTypesClassificationRepository,
    private readonly integrationRepo: IntegrationRepository,
    private readonly assetModelRepo: AssetModelRepository
  ) {}

  async create(c: Context, body: AddAssetTypeRequest) {
    const { integration_client_id, external_properties, ...restRequest } = body
    const userId = Number(c.var.accountID)
    const currentDate = new Date()
    const promises: any[] = []

    const auditData: AuditAssetTypeDTO = {
      created_by: userId,
      updated_by: userId,
      created_at: currentDate,
      updated_at: currentDate,
    }

    const assetTypeData: AddAssetTypeDTO = {
      name: restRequest.name,
      description: restRequest.description,
      ...auditData,
    }

    const assetType = await this.repository.create(c, assetTypeData)

    promises.push(assetType)

    const assetTypeId = Number(assetType.insertId)

    if (body.is_warehouse === 0) {
      if (body.is_cce === 1) {
        if (body.is_temperature_adjustable === 1) {
          promises.push(
            this.assetTypesClassificationRepo.create(c, {
              ...auditData,
              asset_type_id: assetTypeId,
              asset_classifications_id: ASSET_CLASSIFICATION.CCE,
            })
          )

          promises.push(
            this.assetTypesClassificationRepo.create(c, {
              ...auditData,
              asset_type_id: assetTypeId,
              asset_classifications_id: ASSET_CLASSIFICATION.SELECTION,
            })
          )
        } else {
          promises.push(
            this.assetTypesClassificationRepo.create(c, {
              ...auditData,
              asset_type_id: assetTypeId,
              asset_classifications_id: ASSET_CLASSIFICATION.CCE,
            })
          )
        }
      } else if (body.is_cce === 0) {
        promises.push(
          this.assetTypesClassificationRepo.create(c, {
            ...auditData,
            asset_type_id: assetTypeId,
            asset_classifications_id: ASSET_CLASSIFICATION.LOGISTIC,
          })
        )
      }
    } else if (body.is_warehouse === 1) {
      if (body.is_cce_warehouse === 1) {
        promises.push(
          this.assetTypesClassificationRepo.create(c, {
            ...auditData,
            asset_type_id: assetTypeId,
            asset_classifications_id: ASSET_CLASSIFICATION.WAREHOUSE,
          })
        )

        promises.push(
          this.assetTypesClassificationRepo.create(c, {
            ...auditData,
            asset_type_id: assetTypeId,
            asset_classifications_id: ASSET_CLASSIFICATION.CCE_WAREHOUSE,
          })
        )

        if (body.is_temperature_adjustable === 1) {
          promises.push(
            this.assetTypesClassificationRepo.create(c, {
              ...auditData,
              asset_type_id: assetTypeId,
              asset_classifications_id: ASSET_CLASSIFICATION.SELECTION,
            })
          )
        }
      } else {
        promises.push(
          this.assetTypesClassificationRepo.create(c, {
            ...auditData,
            asset_type_id: assetTypeId,
            asset_classifications_id: ASSET_CLASSIFICATION.WAREHOUSE,
          })
        )
      }
    }

    if (body.temperature_thresholds && body.temperature_thresholds.length > 0) {
      for (const temp of body.temperature_thresholds) {
        promises.push(
          this.assetTypesTemperatureRepo.create(c, {
            ...auditData,
            asset_type_id: assetTypeId,
            temperature_threshold_id: temp.id,
          })
        )
      }
    }

    await Promise.all(promises)

    await this.integrationRepo.upsertAssociation(
      c,
      assetTypeId,
      "asset_type",
      external_properties ? JSON.stringify(external_properties) : undefined,
      integration_client_id ?? undefined
    )

    return { id: assetTypeId }
  }

  async update(c: Context, id: number, body: EditAssetTypeRequest) {
    const { integration_client_id, external_properties, ...restRequest } = body
    const userId = Number(c.var.accountID)
    const currentDate = new Date()
    const promises: any[] = []

    const auditData: PartialAuditAssetTypeDTO = {
      updated_by: userId,
      updated_at: currentDate,
    }

    const assetTypeData: EditAssetTypeDTO = {
      name: restRequest.name,
      description: restRequest.description,
      ...auditData,
      integration_client_id: integration_client_id ?? c.var.client?.getId(),
    }

    const temperatureExist =
      await this.repository.getTemperatureThresholdAssetTypeByIds(c, [id])

    promises.push(this.repository.update(c, assetTypeData, { id: id }))

    if (body.temperature_thresholds && body.temperature_thresholds.length > 0) {
      for (const temp of body.temperature_thresholds) {
        const find =
          temperatureExist.filter((t) => t.temperature_threshold_id === temp.id)
            .length > 0

        if (find === false) {
          promises.push(
            this.assetTypesTemperatureRepo.create(c, {
              ...auditData,
              asset_type_id: id,
              temperature_threshold_id: temp.id,
            })
          )
        }
      }
    }

    await Promise.all(promises)

    await this.integrationRepo.upsertAssociation(
      c,
      id,
      "asset_type",
      external_properties ? JSON.stringify(external_properties) : undefined,
      integration_client_id ?? undefined
    )
  }

  async detail(c: Context, id: number) {
    const detail = await this.repository.getDetailAssetTypeById(c, id)
    if (!detail) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", { field: "asset type" })
      )
    }

    const [user, temperature, assetTypeClassification, assetModel] =
      await Promise.all([
        this.userRepo.getByIDsMapped(c, [
          detail.created_by ?? 0,
          detail.updated_by ?? 0,
        ]),
        this.repository.getTemperatureThresholdAssetTypeByIds(c, [id]),
        this.assetTypesClassificationRepo.find(c, { asset_type_id: id }),
        this.assetModelRepo.findOne(c, { asset_type_id: id }),
      ])

    const isWarehouse = assetTypeClassification?.find(
      (item) => item.asset_classifications_id === ASSET_CLASSIFICATION.WAREHOUSE
    )
      ? true
      : false

    return {
      ...detail,
      is_related_asset: assetModel ? 1 : 0,
      is_cce: temperature.length > 0 && isWarehouse === false ? 1 : 0,
      is_warehouse: isWarehouse ? 1 : 0,
      is_cce_warehouse: isWarehouse && temperature.length > 0 ? 1 : 0,
      is_temperature_adjustable: assetTypeClassification?.find(
        (item) =>
          item.asset_classifications_id === ASSET_CLASSIFICATION.SELECTION
      )
        ? 1
        : 0,
      temperature_thresholds: temperature.length > 0 ? temperature : [],
      created_by: detail.created_by ? (user[detail.created_by]?.[0] ?? {}) : {},
      updated_by: detail.updated_by ? (user[detail.updated_by]?.[0] ?? {}) : {},
    }
  }

  async list(c: Context, params: GetAssetTypesQueryParams) {
    const { client } = c.var
    const { data, total } = await this.repository.listAssetType(c, {
      ...params,
      integration_client_id: client?.getId(),
    })

    if (data.length === 0) {
      return new PaginatedResponse(params, data)
    }

    const createdByIds = collect(data, "created_by")
    const updatedByIds = collect(data, "updated_by")
    const ids = collect(data, "id")

    const [users, temperature] = await Promise.all([
      this.userRepo.getByIDsMapped(
        c,
        merge(createdByIds.length ? createdByIds : [0], updatedByIds)
      ),
      this.repository.getTemperatureThresholdAssetTypeByIds(c, ids),
    ])

    const assetTypes = data.map((res) => ({
      ...pick(res, [
        "id",
        "name",
        "description",
        "is_cce",
        "is_related_asset",
        "created_at",
        "updated_at",
      ]),
      user_created_by: users[res.created_by ?? 0]?.[0] ?? {},
      user_updated_by: users[res.updated_by ?? 0]?.[0] ?? {},
      temperature_thresholds:
        temperature.filter((t) => t.asset_type_id === res.id) ?? [],
    }))

    return new PaginatedResponse(params, assetTypes, total)
  }

  async template(c: Context, param: DownloadTemplateQueryParams) {
    const excelTemplate = new AssetTypeTemplate()
    const title = c.var.t("asset_type.template.name")

    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(c.req.header("Timezone"))
    await excelTemplate.loadFile(
      c.var.t(
        `${
          param.type_download_template ===
          TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_WAREHOUSE
            ? "asset_type.warehouse.template.file"
            : "asset_type.template.file"
        }`
      )
    )

    await Promise.all([
      excelTemplate.setTemperatureThresholds(
        this.repository.getTemperatureThresholdStreamData(
          c,
          param.type_download_template ===
            TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_WAREHOUSE
            ? true
            : false
        )
      ),
    ])

    return await excelTemplate.generate(title)
  }

  async export(c: Context, params: GetAssetTypesQueryParams) {
    const stream = await this.repository.getAssetTypesWithDetailStream(
      c,
      params
    )
    const rows: RowType[][] = []
    const timezone = c.req.header("Timezone") || "UTC"

    for await (const item of stream) {
      const row = [
        item.id,
        item.name,
        item.description ?? "-",
        item.is_adjustable === 1 ? 1 : (item.is_cce ?? "-"),
        item.is_adjustable ?? "-",
        item.is_adjustable === 1
          ? item.min_temperature
          : item.is_cce === 1
            ? item.min_temperature
            : "-",
        item.is_adjustable === 1
          ? item.max_temperature
          : item.is_cce === 1
            ? item.max_temperature
            : "-",
        item.updated_by_name ?? "-",
        item.updated_at
          ? moment(item.updated_at).tz(timezone).format("DD/MM/YYYY HH:mm")
          : null,
      ]

      rows.push(row)
    }

    const columns = [
      {
        key: "id",
        header: c.var.t("asset_type.label.id"),
        width: 20,
      },
      {
        key: "name",
        header: c.var.t("asset_type.label.name"),
        width: 30,
      },
      {
        key: "description",
        header: c.var.t("asset_type.label.description"),
        width: 50,
      },
      {
        key: "is_cce",
        header: c.var.t("asset_type.label.is_cce"),
        width: 30,
      },
      {
        key: "is_adjustable",
        header: c.var.t("asset_type.label.is_adjustable"),
        width: 30,
      },
      {
        key: "min_temperature",
        header: c.var.t("asset_type.label.min_temperature"),
        width: 30,
      },
      {
        key: "max_temperature",
        header: c.var.t("asset_type.label.max_temperature"),
        width: 30,
      },
      {
        key: "updated_by",
        header: c.var.t("asset_type.label.updated_by"),
        width: 30,
      },
      {
        key: "updated_at",
        header: c.var.t("asset_type.label.updated_at"),
        width: 30,
      },
    ]

    const sheet = c.var.t("asset_type.export.name")
    const excelTemplate = new AssetTypeExport()
    const language = c.var.language || "en"
    await excelTemplate.initSheet(sheet)

    excelTemplate.setLanguage(language)
    excelTemplate.setTitle(c.var.t("asset_type.export.name"))
    excelTemplate.setTimezone(c.req.header("Timezone"))
    excelTemplate.setColumns(columns)
    await excelTemplate.addRows(sheet, rows)

    return excelTemplate.generate()
  }

  async import(
    c: Context,
    rows: AddAssetTypeImport[],
    params: ImportTemplateQueryParams
  ) {
    for (const row of rows) {
      const temperatureThresholds =
        row.temperature_thresholds !== null &&
        row.temperature_thresholds !== undefined
          ? toArrayInt(row.temperature_thresholds)
          : []

      const temperature_thresholds =
        temperatureThresholds.length > 0
          ? temperatureThresholds.map((id) => ({ id }))
          : []

      const payload = {
        name: row.name,
        description: row.description,
        is_cce:
          params.type_download_template ===
          TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_CCE
            ? row.is_cce
            : (0 as const),
        temperature_thresholds,
        is_temperature_adjustable: row.is_temperature_adjustable,
        is_warehouse: (params.type_download_template ===
        TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_WAREHOUSE
          ? 1
          : 0) as 0 | 1,
        is_cce_warehouse: (params.type_download_template ===
        TYPE_DOWNLOAD_TEMPLATE_ASSET_TYPE.IS_WAREHOUSE
          ? row.is_cce_warehouse
          : 0) as 0 | 1,
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

    const assetTypeWorkspaces =
      await this.repository.getAssetTypeWorkspaceByAssetTypeId(c, id)

    if (assetTypeWorkspaces.length === 0) return programIds

    const assetTypeWorkspaceIds = assetTypeWorkspaces.map(
      (item) => item.workspace_id
    )
    const result = programIds.filter(
      (val) => !assetTypeWorkspaceIds.includes(val)
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
      description: item.description,
      min_temperature: item.min_temperature,
      max_temperature: item.max_temperature,
      created_at: item.created_at,
      updated_at: item.updated_at,
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
}
