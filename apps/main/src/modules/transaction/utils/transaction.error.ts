import { ValidationError } from "@smile/lib/error.js"
import { createMiddleware } from "hono/factory"

export class TransactionErrorHandler {
  private static determineErrorArrayProperty(
    errors: Record<string, string[]>
  ): string {
    return Object.keys(errors).some((key) => key.startsWith("transactions"))
      ? "transactions"
      : "materials"
  }

  private static processErrorMaterials(
    errors: Record<string, string[]>
  ): Record<string, string[]> {
    const { materials = {}, ...otherMaterials } = errors
    for (const material of Object.keys(otherMaterials)) {
      if (materials[material]) {
        materials[material] = [
          ...materials[material],
          ...(otherMaterials[material] || []),
        ]
      } else {
        materials[material] = otherMaterials[material]
      }
    }
    return this.organizeErrorMaterials(materials)
  }

  private static organizeErrorMaterials(
    materials: Record<string, string[]>
  ): Record<string, string[]> {
    const errorMaterial = {}
    for (const key of Object.keys(materials)) {
      const keySplit = key.split(".")
      if (key.includes("patients")) {
        errorMaterial[key] = materials[key]
        continue
      }

      this.keySplitErrorMaterial(errorMaterial, keySplit, materials, key)
    }
    return errorMaterial
  }

  private static keySplitErrorMaterial(
    errorMaterial: object,
    keySplit: string[],
    materials: Record<string, string[]>,
    key: string
  ) {
    const [idx, field1, field2] = keySplit
    if (keySplit.length === 1) {
      errorMaterial[key] = materials[key]
    } else {
      if (!errorMaterial[idx!]) errorMaterial[idx!] = {}
      if (field2) {
        if (!errorMaterial[idx!][field1]) errorMaterial[idx!][field1] = {}
        errorMaterial[idx!][field1][field2] = materials[key]
      } else {
        errorMaterial[idx!][field1] = materials[key]
      }
    }
  }

  private static buildErrorResponse(
    errors: Record<string, string[]>,
    errorArrayProperty: string,
    errorMaterial: Record<string, string[] | undefined>
  ): Record<
    string,
    string[] | boolean | Record<string, string[] | undefined> | undefined
  > {
    const { entity_id, activity_id, entity_activity_id } = errors
    const hasPatients = Object.keys(errorMaterial).some((key) =>
      key.includes("patients")
    )

    const patientErrors: Record<string, string[] | undefined> = {}
    const materialErrors: Record<string, string[] | undefined> = {}

    for (const key of Object.keys(errorMaterial)) {
      if (key.includes("patients")) {
        patientErrors[key] = errorMaterial[key]
      } else {
        materialErrors[key] = errorMaterial[key]
      }
    }

    // Check if materialErrors already contains the errorArrayProperty key
    // to avoid nesting the same key twice
    if (
      materialErrors[errorArrayProperty] &&
      Object.keys(materialErrors).length === 1
    ) {
      return {
        need_confirm: hasPatients,
        entity_id,
        activity_id,
        entity_activity_id,
        [errorArrayProperty]: materialErrors[errorArrayProperty],
        ...(Object.keys(patientErrors).length > 0
          ? { patients: patientErrors }
          : {}),
      }
    }

    return {
      need_confirm: hasPatients,
      entity_id,
      activity_id,
      entity_activity_id,
      ...(Object.keys(materialErrors).length > 0
        ? { [errorArrayProperty]: materialErrors }
        : {}),
      ...(Object.keys(patientErrors).length > 0
        ? { patients: patientErrors }
        : {}),
    }
  }

  static readonly logErrors = createMiddleware(async (c, next) => {
    await next()
    if (c.var.errors) {
      const errors = c.var.errors as Record<string, string[]>
      const errorArrayProperty = this.determineErrorArrayProperty(errors)
      const errorMaterial = this.processErrorMaterials(errors)
      const errorResponse = this.buildErrorResponse(
        errors,
        errorArrayProperty,
        errorMaterial
      )
      c.set("errors", errorResponse)
      throw new ValidationError()
    }
  })
}
