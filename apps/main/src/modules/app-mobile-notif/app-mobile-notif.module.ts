import { ORDER_STATUS } from "@/common/constants/order.js"
import { logger } from "@smile-health/lib/logger.js"
import { Context } from "hono"
import { AppMobileNotifRepository } from "./app-mobile-notif.repository.js"
import {
  ActivityHierarchyNotifDTO,
  ActivityNotifDTO,
  MaterialHierarchyNotifDTO,
  MaterialNotifDTO,
  NotifMaterialHierarchyDTO,
  NotifMaterialNonHierarchyDTO,
  ParentMaterialNotifDTO,
} from "./app-mobile-notif.schema.js"

export class AppMobileNotifModule {
  constructor(private readonly appMobileNotifRepo: AppMobileNotifRepository) {}

  async getNotifMaterial(c: Context) {
    try {
      const entityId = Number(c.req.query("entity_id"))
      const { programId } = c.var

      const isHierarchyEnabled = c.var.config?.material.is_hierarchy_enabled

      if (isHierarchyEnabled) {
        return await this.getNotifMaterialHierarchy(c, entityId, programId)
      } else {
        return await this.getNotifMaterialNonHierarchy(c, entityId, programId)
      }
    } catch (error) {
      logger.error("Error in getNotifMaterial", error)
      throw error
    }
  }

  private async getNotifMaterialHierarchy(
    c: Context,
    entityId: number,
    programId: number
  ): Promise<NotifMaterialHierarchyDTO> {
    const data = await this.appMobileNotifRepo.getNotifMaterialHierarchy(
      c,
      entityId,
      programId
    )

    if (data.length === 0) {
      return {
        id: entityId,
        name: "",
        expired: 0,
        expired_in_30_day: 0,
        activities: [],
      }
    }

    const entityData = {
      id: data[0]?.entity_id ?? entityId,
      name: data[0]?.entity_name ?? "",
      expired: 0,
      expired_in_30_day: 0,
      activities: [] as ActivityHierarchyNotifDTO[],
    }

    // Group by activity
    const activitiesMap = new Map<number, ActivityHierarchyNotifDTO>()

    for (const item of data) {
      if (!activitiesMap.has(item.activity_id)) {
        activitiesMap.set(item.activity_id, {
          id: item.activity_id,
          name: item.activity_name,
          expired: 0,
          expired_in_30_day: 0,
          parent_materials: [],
        })
      }
    }

    // Count unique materials per activity
    for (const activity of activitiesMap.values()) {
      const activityData = data.filter(
        (item) => item.activity_id === activity.id
      )

      const activityExpiredMaterials = new Set<number>()
      const activityExpiredIn30DayMaterials = new Set<number>()

      for (const item of activityData) {
        if (item.expired_qty > 0) {
          activityExpiredMaterials.add(item.material_id)
        }
        if (item.expired_in_30_day_qty > 0) {
          activityExpiredIn30DayMaterials.add(item.material_id)
        }
      }

      activity.expired = activityExpiredMaterials.size
      activity.expired_in_30_day = activityExpiredIn30DayMaterials.size

      // Group by parent material
      const parentMaterialsMap = new Map<number, ParentMaterialNotifDTO>()

      for (const item of activityData) {
        if (!parentMaterialsMap.has(item.parent_material_id)) {
          parentMaterialsMap.set(item.parent_material_id, {
            id: item.parent_material_id,
            name: item.parent_material_name,
            expired: 0,
            expired_in_30_day: 0,
            materials: [],
          })
        }
      }

      // Count unique materials per parent material
      for (const parentMaterial of parentMaterialsMap.values()) {
        const parentMaterialData = activityData.filter(
          (item) => item.parent_material_id === parentMaterial.id
        )

        const parentExpiredMaterials = new Set<number>()
        const parentExpiredIn30DayMaterials = new Set<number>()
        const materialsMap = new Map<number, MaterialHierarchyNotifDTO>()

        for (const item of parentMaterialData) {
          if (!materialsMap.has(item.material_id)) {
            materialsMap.set(item.material_id, {
              id: item.material_id,
              name: item.material_name,
              expired: 0,
              expired_in_30_day: 0,
            })
          }

          const material = materialsMap.get(item.material_id)!
          material.expired += item.expired_qty
          material.expired_in_30_day += item.expired_in_30_day_qty

          if (item.expired_qty > 0) {
            parentExpiredMaterials.add(item.material_id)
          }
          if (item.expired_in_30_day_qty > 0) {
            parentExpiredIn30DayMaterials.add(item.material_id)
          }
        }

        parentMaterial.expired = parentExpiredMaterials.size
        parentMaterial.expired_in_30_day = parentExpiredIn30DayMaterials.size
        parentMaterial.materials = Array.from(materialsMap.values())
      }

      activity.parent_materials = Array.from(parentMaterialsMap.values())
    }

    entityData.activities = Array.from(activitiesMap.values())

    entityData.expired = entityData.activities.reduce(
      (sum, activity) => sum + activity.expired,
      0
    )
    entityData.expired_in_30_day = entityData.activities.reduce(
      (sum, activity) => sum + activity.expired_in_30_day,
      0
    )

    return entityData
  }

  private async getNotifMaterialNonHierarchy(
    c: Context,
    entityId: number,
    programId: number
  ): Promise<NotifMaterialNonHierarchyDTO> {
    const data = await this.appMobileNotifRepo.getNotifMaterialNonHierarchy(
      c,
      entityId,
      programId
    )

    if (data.length === 0) {
      return {
        id: entityId,
        name: "",
        expired: 0,
        expired_in_30_day: 0,
        activities: [],
      }
    }

    const entityData = {
      id: data[0]?.entity_id ?? entityId,
      name: data[0]?.entity_name ?? "",
      expired: 0,
      expired_in_30_day: 0,
      activities: [] as ActivityNotifDTO[],
    }

    // Group by activity
    const activitiesMap = new Map<number, ActivityNotifDTO>()

    for (const item of data) {
      if (!activitiesMap.has(item.activity_id)) {
        activitiesMap.set(item.activity_id, {
          id: item.activity_id,
          name: item.activity_name,
          expired: 0,
          expired_in_30_day: 0,
          materials: [],
        })
      }
    }

    // Count unique materials per activity
    for (const activity of activitiesMap.values()) {
      const activityData = data.filter(
        (item) => item.activity_id === activity.id
      )

      const activityExpiredMaterials = new Set<number>()
      const activityExpiredIn30DayMaterials = new Set<number>()
      const materialsMap = new Map<number, MaterialNotifDTO>()

      for (const item of activityData) {
        if (!materialsMap.has(item.material_id)) {
          materialsMap.set(item.material_id, {
            id: item.material_id,
            name: item.material_name,
            expired: 0,
            expired_in_30_day: 0,
          })
        }

        const material = materialsMap.get(item.material_id)!
        material.expired += item.expired_qty
        material.expired_in_30_day += item.expired_in_30_day_qty

        if (item.expired_qty > 0) {
          activityExpiredMaterials.add(item.material_id)
        }
        if (item.expired_in_30_day_qty > 0) {
          activityExpiredIn30DayMaterials.add(item.material_id)
        }
      }

      activity.expired = activityExpiredMaterials.size
      activity.expired_in_30_day = activityExpiredIn30DayMaterials.size
      activity.materials = Array.from(materialsMap.values())
    }

    entityData.activities = Array.from(activitiesMap.values())

    entityData.expired = entityData.activities.reduce(
      (sum, activity) => sum + activity.expired,
      0
    )
    entityData.expired_in_30_day = entityData.activities.reduce(
      (sum, activity) => sum + activity.expired_in_30_day,
      0
    )

    return entityData
  }

  async getNotifOrder(c: Context) {
    const { entityId, programId } = c.var

    const [totalVendor, totalCustomer] = await Promise.all([
      this.appMobileNotifRepo.getTotalShippedByVendor(
        c,
        programId,
        ORDER_STATUS.SHIPPED,
        Number(entityId)
      ),
      this.appMobileNotifRepo.getTotalShippedByCustomer(
        c,
        programId,
        ORDER_STATUS.SHIPPED,
        Number(entityId)
      ),
    ])

    const newTotalVendor = totalVendor?.total_vendor
      ? Number(totalVendor?.total_vendor)
      : 0
    const newTotalCustomer = totalCustomer?.total_customer
      ? Number(totalCustomer?.total_customer)
      : 0
    const total = newTotalVendor + newTotalCustomer

    const data = {
      total: total,
      as_vendor: newTotalVendor,
      as_customer: newTotalCustomer,
    }

    const result = { order_not_received: data }

    return result
  }
}
