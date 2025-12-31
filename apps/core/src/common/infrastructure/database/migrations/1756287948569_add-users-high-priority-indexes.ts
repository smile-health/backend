import { Kysely } from "kysely"
import { Database } from "../types/index.js"

export async function up(db: Kysely<Database>): Promise<void> {
  // High priority indexes for user lookups
  await db.schema
    .createIndex("idx_users_username")
    .on("users")
    .column("username")
    .execute()

  await db.schema
    .createIndex("idx_users_email")
    .on("users")
    .column("email")
    .execute()

  await db.schema
    .createIndex("idx_users_user_uuid")
    .on("users")
    .column("user_uuid")
    .execute()

  await db.schema
    .createIndex("idx_users_keycloak_uuid")
    .on("users")
    .column("keycloak_uuid")
    .execute()

  await db.schema
    .createIndex("idx_users_role")
    .on("users")
    .column("role")
    .execute()

  await db.schema
    .createIndex("idx_users_entity_id")
    .on("users")
    .column("entity_id")
    .execute()

  // Composite index for common filtering patterns
  await db.schema
    .createIndex("idx_users_status_deleted_at")
    .on("users")
    .columns(["status", "deleted_at"])
    .execute()
  
  await db.schema
    .createIndex("idx_user_workspaces_status")
    .on("user_workspaces")
    .columns(["status"])
    .execute()
  
    await db.schema
    .createIndex("idx_user_workspaces_deleted_at")
    .on("user_workspaces")
    .columns(["deleted_at"])
    .execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropIndex("idx_users_username").on("users").execute()
  await db.schema.dropIndex("idx_users_email").on("users").execute()
  await db.schema.dropIndex("idx_users_user_uuid").on("users").execute()
  await db.schema.dropIndex("idx_users_keycloak_uuid").on("users").execute()
  await db.schema.dropIndex("idx_users_role").on("users").execute()
  await db.schema.dropIndex("idx_users_entity_id").on("users").execute()
  await db.schema.dropIndex("idx_users_status_deleted_at").on("users").execute()
  await db.schema.dropIndex("idx_user_workspaces_deleted_at").on("user_workspaces").execute()
  await db.schema.dropIndex("idx_user_workspaces_status").on("user_workspaces").execute()
}