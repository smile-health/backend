import { Kysely, sql } from "kysely";
import { Database } from "../types/db";

export async function up(db: Kysely<Database>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id bigint NOT NULL AUTO_INCREMENT,
      user_id varchar(255) NOT NULL,
      email varchar(255) NOT NULL,
      token varchar(255) NOT NULL,
      expires_at datetime(3) NOT NULL,
      used_at datetime(3) DEFAULT NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      INDEX idx_password_reset_tokens_token (token),
      INDEX idx_password_reset_tokens_email (email),
      INDEX idx_password_reset_tokens_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `.execute(db);
}

export async function down(db: Kysely<Database>): Promise<void> {
  await sql`DROP TABLE IF EXISTS password_reset_tokens`.execute(db);
}
