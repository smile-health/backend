import { filterHeaders } from "@/common/common.helper.js"
import { MATERIAL_TYPE } from "@/common/constant/material.js"
import { PROGRAM } from "@/common/constant/program.js"
import { SERVER_URL } from "@/common/constant/url.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { logError } from "@/common/logger.repository.js"
import {
  getExistingId,
  getExistingIds,
  insertMapping,
} from "@/common/mapping.repository.js"
import { CustomContext } from "@smile-health/lib/types/context.js"
import { AxiosError } from "axios"
import { isUndefined } from "lodash"
import {
  MAP_ENITTY_TYPE,
  MAP_MATERIAL_KFA_CODE,
  MAP_MATERIAL_LOGISTIC_TYPE,
  MAP_MATERIAL_UNIT_CONSUMPTION,
  MAP_MATERIAL_UNIT_DISTRIBUTION,
  MAP_USER_ROLE,
} from "./material.constant.js"
import {
  MaterialGatewayResponse,
  MaterialIncomingMessage,
  MaterialOutgoingMessage,
} from "./material.schema.js"

export class MaterialGateway {
  public async create(c: CustomContext<DB>, message: MaterialIncomingMessage) {
    try {
      const { headers, payload } = message

      for (const material of payload) {
        let materialData: MaterialOutgoingMessage = {
          id: material.id,
          program_id: material.program_id,
          name: material.name,
          description: material.description ?? "-",
          code: material.code,
          code_kfa: material.hierarchy_code,
          kfa_level_id: material.material_level_id,
          unit: MAP_MATERIAL_UNIT_CONSUMPTION[material.unit_of_consumption_id],
          unit_of_distribution:
            MAP_MATERIAL_UNIT_DISTRIBUTION[material.unit_of_distribution_id],
          pieces_per_unit: material.consumption_unit_per_distribution_unit,
          temperature_sensitive: material.is_temperature_sensitive,
          temperature_min: material.min_temperature,
          temperature_max: material.max_temperature,
          min_retail_price: material.min_retail_price,
          max_retail_price: material.max_retail_price,
          managed_in_batch: material.is_managed_in_batch,
          status: material.status,
        }

        if (material.program_id === PROGRAM.LOGISTIC) {
          materialData = {
            ...materialData,
            parent_id: await getExistingId(
              c,
              "materials",
              material.parent_id,
              material.program_id
            ),
            kfa: {
              id: material.material_level_id,
              code: MAP_MATERIAL_KFA_CODE[material.material_level_id],
            },
          }
        }

        const response = await fetch(
          `${SERVER_URL[material.program_id]}/v2/material`,
          {
            method: "POST",
            headers: filterHeaders(headers),
            body: JSON.stringify(materialData),
          }
        )

        if (!response.ok) {
          throw new Error(JSON.stringify(await response.json()))
        }

        const responseJson: MaterialGatewayResponse =
          (await response.json()) as MaterialGatewayResponse

        const mappingMaterialData = {
          program_id: material.program_id,
          platform_material_id: material.id,
          existing_material_id: responseJson.id,
          platform_global_id: material.global_id,
        }

        await insertMapping(c, "mapping_materials", mappingMaterialData)

        console.log("Success create mapping")
      }

      console.log("Success Sync Create to 3.0")
    } catch (error) {
      await logError(c, error)
      if (error instanceof AxiosError) {
        console.log(error.response?.data)
      } else {
        console.log(error)
        throw new Error("An unknown error occurred")
      }
    }
  }

  public async update(c: CustomContext<DB>, message: MaterialIncomingMessage) {
    try {
      const { headers, payload } = message

      for (const material of payload) {
        const mappingMaterial = await c.var.trx
          .selectFrom("mapping_materials")
          .where("platform_material_id", "=", material.id)
          .where("program_id", "=", material.program_id)
          .selectAll()
          .executeTakeFirst()

        const materialData: MaterialOutgoingMessage = {
          id: material.id,
          program_id: material.program_id,
          name: material.name,
          description: material.description ?? "-",
          code: material.code,
          code_kfa: material.hierarchy_code,
          kfa_level_id: material.material_level_id,
          unit: MAP_MATERIAL_UNIT_CONSUMPTION[material.unit_of_consumption_id],
          unit_of_distribution:
            MAP_MATERIAL_UNIT_DISTRIBUTION[material.unit_of_distribution_id],
          pieces_per_unit: material.consumption_unit_per_distribution_unit,
          temperature_sensitive: material.is_temperature_sensitive,
          temperature_min: material.min_temperature,
          temperature_max: material.max_temperature,
          min_retail_price: material.min_retail_price,
          max_retail_price: material.max_retail_price,
          managed_in_batch: material.is_managed_in_batch,
          status: material.status,
        }

        await this.addMaterialLogistik(c, materialData, material)

        this.addMaterialIsVaccine(materialData, material)

        // Since one material could have many activities, we assume the first activity as its
        // logistic type activity pair
        this.addMaterialManyActivityIsVaccine(materialData, material)

        if (!isUndefined(material.material_companion)) {
          Object.assign(materialData, {
            material_companion: await getExistingIds(
              c,
              "materials",
              material.material_companion,
              material.program_id
            ),
          })
        }

        if (!isUndefined(material.manufactures)) {
          Object.assign(materialData, {
            manufactures: await getExistingIds(
              c,
              "manufactures",
              material.manufactures,
              material.program_id
            ),
          })
        }

        if (!isUndefined(material.activities)) {
          Object.assign(materialData, {
            activities: await getExistingIds(
              c,
              "activities",
              material.activities,
              material.program_id
            ),
          })
        }

        if (!isUndefined(material.addremove)) {
          const addremove = {
            entity_types: material.addremove?.entity_types.map(
              (entityType) => MAP_ENITTY_TYPE[entityType]
            ),
            roles: material.addremove?.roles.map((role) => MAP_USER_ROLE[role]),
          }
          Object.assign(materialData, {
            is_addremove: material.is_addremove,
            addremove: addremove,
          })
        }

        await this.createOrUpdateExistingMaterial(
          c,
          mappingMaterial,
          materialData,
          material,
          headers
        )
      }

      console.log("Success Sync Create to 3.0")
    } catch (error) {
      await logError(c, error)
      if (error instanceof AxiosError) {
        console.log(error.response?.data)
      } else {
        console.log(error)
        throw new Error("An unknown error occurred")
      }
    }
  }

  private async addMaterialLogistik(
    c: CustomContext<DB>,
    materialData: MaterialOutgoingMessage,
    material: Pick<MaterialIncomingMessage, "payload">["payload"][0]
  ) {
    if (material.program_id === PROGRAM.LOGISTIC) {
      materialData.parent_id = await getExistingId(
        c,
        "materials",
        material.parent_id,
        material.program_id
      )
      materialData.kfa = {
        id: material.material_level_id,
        code: MAP_MATERIAL_KFA_CODE[material.material_level_id],
      }
    }
  }

  private addMaterialIsVaccine(
    materialData: MaterialOutgoingMessage,
    material: Pick<MaterialIncomingMessage, "payload">["payload"][0]
  ) {
    if (
      material.activities &&
      material.material_type_id &&
      material.program_id === PROGRAM.IMMUNIZATION
    ) {
      materialData.is_vaccine =
        material.material_type_id === MATERIAL_TYPE.VACCINE ? 1 : 0
    }
  }

  private addMaterialManyActivityIsVaccine(
    materialData: MaterialOutgoingMessage,
    material: Pick<MaterialIncomingMessage, "payload">["payload"][0]
  ) {
    if (
      material.activities &&
      material.material_type_id &&
      material.program_id === PROGRAM.LOGISTIC
    ) {
      const materialActivity =
        material.activities && material.activities.length > 0
          ? material.activities[0]
          : 0

      const logisticMaterialType = MAP_MATERIAL_LOGISTIC_TYPE.find(
        (mapMaterialType) =>
          mapMaterialType.platfrom_material_type_id ===
            material.material_type_id &&
          mapMaterialType.platform_activity_id === materialActivity
      )

      materialData.is_vaccine =
        logisticMaterialType?.logistic_material_type_id ?? 0
    }
  }

  private async createOrUpdateExistingMaterial(
    c: CustomContext<DB>,
    mappingMaterial: any,
    materialData: MaterialOutgoingMessage,
    material: Pick<MaterialIncomingMessage, "payload">["payload"][0],
    headers: any
  ) {
    if (mappingMaterial) {
      const response = await fetch(
        `${SERVER_URL[material.program_id]}/v2/material/${mappingMaterial.existing_material_id}`,
        {
          method: "PUT",
          headers: filterHeaders(headers),
          body: JSON.stringify(materialData),
        }
      )

      if (!response.ok) {
        throw new Error(JSON.stringify(await response.json()))
      }
    } else {
      const response = await fetch(
        `${SERVER_URL[material.program_id]}/v2/material`,
        {
          method: "POST",
          headers: filterHeaders(headers),
          body: JSON.stringify(materialData),
        }
      )

      if (!response.ok) {
        throw new Error(JSON.stringify(await response.json()))
      }

      const responseJson: MaterialGatewayResponse =
        (await response.json()) as MaterialGatewayResponse

      const mappingMaterialData = {
        program_id: material.program_id,
        platform_material_id: material.id,
        existing_material_id: responseJson.id,
        platform_global_id: material.global_id,
      }

      await insertMapping(c, "mapping_materials", mappingMaterialData)
    }
  }
}
