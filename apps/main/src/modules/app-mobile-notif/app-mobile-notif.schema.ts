import { z } from "zod"

// Base entity response
export const EntityNotifMaterialBaseSchema = z.object({
  id: z.number(),
  name: z.string(),
  expired: z.number(),
  expired_in_30_day: z.number(),
})

// Material schema for non-hierarchical response
export const MaterialNotifSchema = z.object({
  id: z.number(),
  name: z.string(),
  expired: z.number(),
  expired_in_30_day: z.number(),
})

// Activity schema for non-hierarchical response
export const ActivityNotifSchema = EntityNotifMaterialBaseSchema.extend({
  materials: z.array(MaterialNotifSchema),
})

// Non-hierarchical response schema
export const NotifMaterialNonHierarchySchema =
  EntityNotifMaterialBaseSchema.extend({
    activities: z.array(ActivityNotifSchema),
  })

// Material schema for hierarchical response
export const MaterialHierarchyNotifSchema = MaterialNotifSchema

// Parent material schema for hierarchical response
export const ParentMaterialNotifSchema = EntityNotifMaterialBaseSchema.extend({
  materials: z.array(MaterialHierarchyNotifSchema),
})

// Activity schema for hierarchical response
export const ActivityHierarchyNotifSchema =
  EntityNotifMaterialBaseSchema.extend({
    parent_materials: z.array(ParentMaterialNotifSchema),
  })

// Hierarchical response schema
export const NotifMaterialHierarchySchema =
  EntityNotifMaterialBaseSchema.extend({
    activities: z.array(ActivityHierarchyNotifSchema),
  })

// Response type definitions
export type NotifMaterialNonHierarchyDTO = z.infer<
  typeof NotifMaterialNonHierarchySchema
>
export type NotifMaterialHierarchyDTO = z.infer<
  typeof NotifMaterialHierarchySchema
>
export type ActivityNotifDTO = z.infer<typeof ActivityNotifSchema>
export type ActivityHierarchyNotifDTO = z.infer<
  typeof ActivityHierarchyNotifSchema
>
export type MaterialNotifDTO = z.infer<typeof MaterialNotifSchema>
export type MaterialHierarchyNotifDTO = z.infer<
  typeof MaterialHierarchyNotifSchema
>
export type ParentMaterialNotifDTO = z.infer<typeof ParentMaterialNotifSchema>
