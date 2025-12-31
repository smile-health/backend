import type { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function seed(db: Kysely<Database>): Promise<void> {
  const entityTypes = [
    { id: 1, name: "province" },
    { id: 2, name: "regency" },
    { id: 3, name: "healthcare_facility" },
    { id: 4, name: "district_health_center" },
    { id: 5, name: "central" },
    { id: 6, name: "third_party" },
  ]
  const entityTags = [
    { id: 1, title: "main_supplier" },
    { id: 2, title: "producer" },
    { id: 3, title: "ministry_of_health", deleted_at: "2025-06-13 10:04:02" },
    { id: 4, title: "port_health_services", deleted_at: "2025-06-13 10:04:02" },
    { id: 5, title: "provincial_health_office" },
    { id: 7, title: "city_district_health_office" },
    { id: 9, title: "community_health_center" },
    { id: 10, title: "in_building", is_open_vial: 1 },
    { id: 11, title: "hospital" },
    { id: 12, title: "clinic" },
    { id: 13, title: "community_health_post" },
    { id: 14, title: "school" },
    { id: 15, title: "independent_midwife" },
    { id: 17, title: "mass_vaccination" },
    { id: 18, title: "sub_community_health_center" },
    { id: 19, title: "central_vaccine_warehouse" },
    { id: 20, title: "central_pharmacy_installation" },
    {
      id: 21,
      title: "central_health_crisis_center",
      deleted_at: "2025-06-13 10:04:03",
    },
    { id: 23, title: "military" },
    { id: 24, title: "police" },
    { id: 25, title: "intelligence_agency" },
    { id: 26, title: "village_community_health_center" },
    { id: 27, title: "emergency_department" },
    { id: 28, title: "pharmacy_room" },
    { id: 29, title: "laboratory" },
    { id: 30, title: "village" },
    { id: 31, title: "village_malaria_officer" },
    { id: 32, title: "port_health_office" },
    { id: 33, title: "tb_clinic" },
    { id: 34, title: "hiv_clinic" },
    { id: 35, title: "independent_practice_doctor" },
    { id: 36, title: "transporter" },
    { id: 37, title: "treatment" },
    { id: 38, title: "landfill" },
    { id: 39, title: "recycle" },
    { id: 40, title: "government_waste_transporter" },
    { id: 41, title: "specialized_transporter" },
    { id: 42, title: "residential_areas" },
    { id: 43, title: "workplaces" },
    { id: 44, title: "recreational_areas" },
    { id: 45, title: "public_facilities" },
    { id: 46, title: "waste_processor" },
  ]

  // DELETE ALL DATA FIRST
  await db.deleteFrom("entity_types").execute()
  await db.deleteFrom("entity_tags").execute()
  // INSERT DATA INTO TABLES
  await db.insertInto("entity_types").values(entityTypes).execute()
  await db.insertInto("entity_tags").values(entityTags).execute()
}
