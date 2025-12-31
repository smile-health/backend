import { LOCATION } from "@/common/constants/location.js"
import { USER_ROLE } from "@/common/constants/users.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { BaseModule } from "../base.module.js"
import { EntityTagRepository } from "../entity-tag/entity-tag.repository.js"
import { EntityTypeRepository } from "../entity-type/entity-type.repository.js"
import { ExportHistoryRepository } from "../export-history/export-history.repository.js"
import { IntegrationRepository } from "../integration/integration.repository.js"
import { LocationRepository } from "../location/location.repository.js"
import { WorkspaceRepository } from "../workspace/workspace.repository.js"
import { EntityTemplate } from "./entity.excel.js"
import { EntityPublisher } from "./entity.publisher.js"
import { EntityRepository } from "./entity.repository.js"
import {
  EntityDto,
  GetEntitiesQueries,
  ImportEntityRequest,
  ListEntityDTO,
  LocationsDTO,
  TCreateEntityRequest,
} from "./entity.schema.js"

export class EntityModule extends BaseModule {
  constructor(
    private readonly repository: EntityRepository,
    private readonly workspaceRepo: WorkspaceRepository,
    private readonly locationRepo: LocationRepository,
    private readonly entityTypeRepo: EntityTypeRepository,
    private readonly entityTagRepo: EntityTagRepository,
    private readonly integrationRepo: IntegrationRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    protected readonly publisher: EntityPublisher
  ) {
    super(exportHistoryRepo, publisher)
  }

  #mappedLocationData(result: ListEntityDTO) {
    const locationKeys = ["province", "regency", "sub_district", "village"]
    const location: LocationsDTO[] = []

    for (const key of locationKeys) {
      const idKey = `${key}_id`
      const nameKey = `${key}_name`
      const levelKey = `${key}_level`

      if (result[idKey]) {
        location.push({
          id: result[idKey],
          name: result[nameKey],
          level: result[levelKey],
        })
      }
    }

    return location
  }

  #remappedListEntityResponse(listEntity: ListEntityDTO[]) {
    return listEntity.map((item) => {
      const locations = this.#mappedLocationData(item)
      return {
        id: item.id,
        code: item.code,
        type: item.type,
        status: item.status,
        name: item.name,
        id_satu_sehat: item.id_satu_sehat,
        entity_tag_id: item.entity_tag_id,
        is_puskesmas: item.is_puskesmas,
        is_vendor: item.is_vendor,
        locations,
        integration_client_id: item.integration_client_id ?? null,
        external_properties: item.external_properties,
        entity_tag: {
          id: item.tag_id,
          title: item.tag,
        },
        entity_type: [
          {
            id: item.type_id,
            name: item.type_name,
          },
        ],
        programs: [],
        beneficiaries: [] as any[],
      }
    })
  }

  async list(c: Context, params: GetEntitiesQueries) {
    let resultList, resultTotal

    if (
      params.is_asset === 1 &&
      (c.var.role === USER_ROLE.OPERATOR ||
        c.var.role === USER_ROLE.MANAGER ||
        c.var.role === USER_ROLE.ADMIN)
    ) {
      const [entity] = await this.repository.findByIds(c, [
        Number(c.var.entityId),
      ])
      const { list, total } = await this.repository.getListEntityIsAsset(
        c,
        Number(c.var.entityId),
        params,
        Number(entity?.province_id ?? null),
        Number(entity?.regency_id ?? null),
        Number(entity?.sub_district_id ?? null),
        Number(entity?.village_id ?? null)
      )
      resultList = list
      resultTotal = total
    } else if (
      params.is_asset === 1 &&
      params.entity_id &&
      c.var.role === USER_ROLE.SUPERADMIN
    ) {
      const [entity] = await this.repository.findByIds(c, [
        Number(params.entity_id),
      ])
      const { list, total } = await this.repository.getListEntityIsAsset(
        c,
        Number(params.entity_id),
        params,
        Number(entity?.province_id ?? null),
        Number(entity?.regency_id ?? null),
        Number(entity?.sub_district_id ?? null),
        Number(entity?.village_id ?? null)
      )
      resultList = list
      resultTotal = total
    } else {
      const { list, total } = await this.repository.getListEntity(c, params)
      resultList = list
      resultTotal = total
    }

    const remappedEntity = this.#remappedListEntityResponse(resultList)
    const entityIDs = remappedEntity.map((entity) => Number(entity.id))

    if (entityIDs.length > 0) {
      const [allWorkspaces] = await Promise.all([
        this.workspaceRepo.getByFromMappedWorkspace(c, "entity", entityIDs),
      ])

      // Filter workspaces into programs and beneficiaries
      const programs: Record<number, any[]> = {}
      const beneficiaries: Record<number, any[]> = {}

      entityIDs.forEach((entityId) => {
        const workspaces = allWorkspaces[entityId] ?? []
        programs[entityId] = workspaces.filter((w) => w.is_beneficiaries === 0)
        beneficiaries[entityId] = workspaces.filter(
          (w) => w.is_beneficiaries === 1
        )
      })

      remappedEntity.forEach((res) => {
        res.programs = programs[Number(res.id)] ?? []
        res.beneficiaries = beneficiaries[Number(res.id)] ?? []
        return res
      })
    }

    return new PaginatedResponse(
      params,
      remappedEntity,
      Number(resultTotal ?? 0)
    )
  }

  async getDetail(c: Context, entityID: number) {
    const entity = await this.repository.findById(c, entityID)
    const allWorkspaces = await this.workspaceRepo.getByFromMappedWorkspace(
      c,
      "entity",
      Number(entity.id)
    )
    const workspaces = allWorkspaces[entityID] ?? []
    const baseResponse = {
      ...entity,
      lat: entity.lat !== "" ? entity.lat : null,
      lng: entity.lng !== "" ? entity.lng : null,
    }

    return {
      programs: workspaces.filter((w) => w.is_beneficiaries === 0),
      beneficiaries: workspaces.filter((w) => w.is_beneficiaries === 1),
      ...baseResponse,
    }
  }

  async saveEntity(c: Context, req: TCreateEntityRequest) {
    const { program_ids, ...data } = req
    const entityDto = EntityDto.parse(data)

    const {
      integration_client_id,
      external_properties,
      province_id,
      regency_id,
      sub_district_id,
      village_id,
      ...restEntityDto
    } = entityDto

    const payload = {
      ...restEntityDto,
      province_id: province_id !== "" ? province_id : null,
      regency_id: regency_id !== "" ? regency_id : null,
      sub_district_id: sub_district_id !== "" ? sub_district_id : null,
      village_id: village_id !== "" ? village_id : null,
      created_by: c.var.accountID,
      updated_by: c.var.accountID,
    }

    const newEntityID = await this.repository.save(c, payload)

    await Promise.all([
      this.workspaceRepo.attachWithEntityID(
        c,
        Number(newEntityID),
        Array.isArray(program_ids) && program_ids.length ? program_ids : [0]
      ),
      this.publisher.processCreate(c, newEntityID),
      this.integrationRepo.upsertAssociation(
        c,
        Number(newEntityID),
        "entity",
        external_properties ? JSON.stringify(external_properties) : undefined,
        integration_client_id ?? undefined
      ),
    ])

    return this.getDetail(c, Number(newEntityID))
  }

  async updateEntity(c: Context, req: TCreateEntityRequest, entityID: number) {
    const { program_ids, ...data } = req
    const entityDto = EntityDto.parse(data)

    const {
      integration_client_id,
      external_properties,
      province_id,
      regency_id,
      sub_district_id,
      village_id,
      ...restEntityDto
    } = entityDto
    const payload = {
      ...restEntityDto,
      province_id: province_id !== "" ? province_id : null,
      regency_id: regency_id !== "" ? regency_id : null,
      sub_district_id: sub_district_id !== "" ? sub_district_id : null,
      village_id: village_id !== "" ? village_id : null,
      updated_at: new Date(),
      updated_by: c.var.accountID,
    }

    await Promise.all([
      this.repository.update(c, payload, entityID),
      this.workspaceRepo.attachWithEntityID(
        c,
        entityID,
        Array.isArray(program_ids) && program_ids.length ? program_ids : [0]
      ),
      this.publisher.processUpdate(c, entityID),
      this.integrationRepo.upsertAssociation(
        c,
        entityID,
        "entity",
        external_properties ? JSON.stringify(external_properties) : undefined,
        integration_client_id ?? undefined
      ),
    ])

    return this.getDetail(c, entityID)
  }

  async getExportedData(c: Context, param: GetEntitiesQueries) {
    return await this.handleAsyncExport(c, TOPIC.ENTITY_EXPORTED, {
      filename: c.var.t("common.entity"),
      params: param,
    })
  }

  async getTemplate(c: Context) {
    const language = c.var.language
    const title = language === "en" ? "Entity" : "Entitas"
    const filename = `entity_${language.toLowerCase()}.xlsx`
    const excelTemplate = new EntityTemplate()
    excelTemplate.setTitle(`${title} Template`)
    await excelTemplate.loadFile(filename)
    await Promise.all([
      excelTemplate.addRows(
        c.var.t("entity.sheet.type"),
        await this.entityTypeRepo.getEntityTypeStream(c)
      ),
      excelTemplate.addRows(
        c.var.t("entity.sheet.entity_tag"),
        await this.entityTagRepo.getEntityTagStream(c)
      ),
      excelTemplate.addRows(
        c.var.t("entity.sheet.province"),
        this.locationRepo.getLocationByLevelStream(c, LOCATION.PROVINCE)
      ),
      excelTemplate.addRows(
        c.var.t("entity.sheet.regency"),
        this.locationRepo.getLocationByLevelStream(c, LOCATION.REGENCY)
      ),
      excelTemplate.addRows(
        c.var.t("entity.sheet.sub_district"),
        this.locationRepo.getLocationByLevelStream(c, LOCATION.SUBDISTRICT)
      ),
      excelTemplate.addRows(
        c.var.t("entity.sheet.village"),
        this.locationRepo.getLocationByLevelStream(c, LOCATION.VILLAGE)
      ),
      excelTemplate.addRows(
        c.var.t("entity.sheet.program"),
        this.workspaceRepo.getStreamData(c)
      ),
    ])

    return await excelTemplate.generateTemplate()
  }

  async import(c: Context, rows: ImportEntityRequest[]) {
    // const programsPerID = new Map<number, number[]>()
    for (const row of rows) {
      const createEntityDto: TCreateEntityRequest = {
        name: row.Name,
        code: row.Code,
        address: row.Address,
        type: row.TypeId,
        entity_tag_id: row.EntityTagId,
        province_id: row.ProvinceId?.toString(),
        regency_id: row.RegencyId?.toString(),
        sub_district_id: row.SubDistrictId?.toString(),
        village_id: row.VillageId?.toString(),
        program_ids: row.ProgramId,
        postal_code: row.PostalId,
        lat: row.Latitude,
        lng: row.Longitude,
        country: row.Country,
        status: row.Status,
        id_satu_sehat: row?.idSatuSehat?.toString() ?? undefined,
      }

      const { program_ids, ...entityDto } = createEntityDto

      const newEntityID = await this.repository.save(c, entityDto)

      if (program_ids && program_ids.length > 0) {
        await this.workspaceRepo.attachWithEntityID(
          c,
          Number(newEntityID),
          program_ids
        )
      }

      // programsPerID.set(Number(newEntityID), program_ids ?? []) // this variable Map never use ?
    }

    return this.#messageResponse(`create ${rows.length} rows`)
  }

  #messageResponse(info: string) {
    return {
      success: true,
      message: `Data successfully ${info}`,
    }
  }
}
