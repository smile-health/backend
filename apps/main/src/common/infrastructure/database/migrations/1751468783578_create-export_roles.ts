import { type Kysely } from "kysely"
import { Database } from "../types/index.js"
import { addTimestampColumns } from "../helper.js"

export async function up(db: Kysely<Database>): Promise<void> {
  const EXPORT_ROLES = [
    {
      id: 1,
      export_code: 1,
      role_id: 1,
    },
    {
      id: 2,
      export_code: 2,
      role_id: 1,
    },
    {
      id: 3,
      export_code: 3,
      role_id: 1,
    },
    {
      id: 4,
      export_code: 4,
      role_id: 1,
    },
    {
      id: 5,
      export_code: 5,
      role_id: 1,
    },
    {
      id: 6,
      export_code: 6,
      role_id: 1,
    },
    {
      id: 7,
      export_code: 7,
      role_id: 1,
    },
    {
      id: 8,
      export_code: 8,
      role_id: 1,
    },
    {
      id: 9,
      export_code: 9,
      role_id: 1,
    },
    {
      id: 10,
      export_code: 10,
      role_id: 1,
    },
    {
      id: 11,
      export_code: 11,
      role_id: 1,
    },
    {
      id: 12,
      export_code: 12,
      role_id: 1,
    },
    {
      id: 13,
      export_code: 13,
      role_id: 1,
    },
    {
      id: 14,
      export_code: 14,
      role_id: 1,
    },
    {
      id: 15,
      export_code: 15,
      role_id: 1,
    },
    {
      id: 16,
      export_code: 16,
      role_id: 1,
    },
    {
      id: 17,
      export_code: 17,
      role_id: 1,
    },
    {
      id: 18,
      export_code: 18,
      role_id: 1,
    },
    {
      id: 19,
      export_code: 1,
      role_id: 2,
    },
    {
      id: 20,
      export_code: 2,
      role_id: 2,
    },
    {
      id: 21,
      export_code: 3,
      role_id: 2,
    },
    {
      id: 22,
      export_code: 4,
      role_id: 2,
    },
    {
      id: 23,
      export_code: 5,
      role_id: 2,
    },
    {
      id: 24,
      export_code: 6,
      role_id: 2,
    },
    {
      id: 25,
      export_code: 7,
      role_id: 2,
    },
    {
      id: 26,
      export_code: 8,
      role_id: 2,
    },
    {
      id: 27,
      export_code: 9,
      role_id: 2,
    },
    {
      id: 28,
      export_code: 10,
      role_id: 2,
    },
    {
      id: 29,
      export_code: 11,
      role_id: 2,
    },
    {
      id: 30,
      export_code: 12,
      role_id: 2,
    },
    {
      id: 31,
      export_code: 13,
      role_id: 2,
    },
    {
      id: 32,
      export_code: 14,
      role_id: 2,
    },
    {
      id: 33,
      export_code: 15,
      role_id: 2,
    },
    {
      id: 34,
      export_code: 16,
      role_id: 2,
    },
    {
      id: 35,
      export_code: 17,
      role_id: 2,
    },
    {
      id: 36,
      export_code: 18,
      role_id: 2,
    },
    {
      id: 37,
      export_code: 1,
      role_id: 3,
    },
    {
      id: 38,
      export_code: 2,
      role_id: 3,
    },
    {
      id: 39,
      export_code: 3,
      role_id: 3,
    },
    {
      id: 40,
      export_code: 4,
      role_id: 3,
    },
    {
      id: 41,
      export_code: 5,
      role_id: 3,
    },
    {
      id: 42,
      export_code: 6,
      role_id: 3,
    },
    {
      id: 43,
      export_code: 7,
      role_id: 3,
    },
    {
      id: 44,
      export_code: 8,
      role_id: 3,
    },
    {
      id: 45,
      export_code: 9,
      role_id: 3,
    },
    {
      id: 46,
      export_code: 10,
      role_id: 3,
    },
    {
      id: 47,
      export_code: 11,
      role_id: 3,
    },
    {
      id: 48,
      export_code: 12,
      role_id: 3,
    },
    {
      id: 49,
      export_code: 13,
      role_id: 3,
    },
    {
      id: 50,
      export_code: 14,
      role_id: 3,
    },
    {
      id: 51,
      export_code: 15,
      role_id: 3,
    },
    {
      id: 52,
      export_code: 16,
      role_id: 3,
    },
    {
      id: 53,
      export_code: 17,
      role_id: 3,
    },
    {
      id: 54,
      export_code: 18,
      role_id: 3,
    },
    {
      id: 55,
      export_code: 21,
      role_id: 1,
    },
    {
      id: 56,
      export_code: 21,
      role_id: 2,
    },
    {
      id: 57,
      export_code: 21,
      role_id: 3,
    },
    {
      id: 58,
      export_code: 22,
      role_id: 1,
    },
    {
      id: 59,
      export_code: 22,
      role_id: 2,
    },
    {
      id: 60,
      export_code: 22,
      role_id: 3,
    },
    {
      id: 61,
      export_code: 22,
      role_id: 8,
    },
    {
      id: 66,
      export_code: 39,
      role_id: 1,
    },
    {
      id: 67,
      export_code: 39,
      role_id: 2,
    },
    {
      id: 68,
      export_code: 39,
      role_id: 3,
    },
    {
      id: 69,
      export_code: 39,
      role_id: 8,
    },
    {
      id: 166,
      export_code: 23,
      role_id: 1,
    },
    {
      id: 167,
      export_code: 24,
      role_id: 1,
    },
    {
      id: 168,
      export_code: 25,
      role_id: 1,
    },
    {
      id: 169,
      export_code: 26,
      role_id: 1,
    },
    {
      id: 170,
      export_code: 27,
      role_id: 1,
    },
    {
      id: 171,
      export_code: 28,
      role_id: 1,
    },
    {
      id: 172,
      export_code: 29,
      role_id: 1,
    },
    {
      id: 173,
      export_code: 30,
      role_id: 1,
    },
    {
      id: 174,
      export_code: 31,
      role_id: 1,
    },
    {
      id: 175,
      export_code: 32,
      role_id: 1,
    },
    {
      id: 176,
      export_code: 33,
      role_id: 1,
    },
    {
      id: 177,
      export_code: 34,
      role_id: 1,
    },
    {
      id: 178,
      export_code: 35,
      role_id: 1,
    },
    {
      id: 179,
      export_code: 36,
      role_id: 1,
    },
    {
      id: 180,
      export_code: 37,
      role_id: 1,
    },
    {
      id: 181,
      export_code: 38,
      role_id: 1,
    },
    {
      id: 182,
      export_code: 23,
      role_id: 2,
    },
    {
      id: 183,
      export_code: 24,
      role_id: 2,
    },
    {
      id: 184,
      export_code: 25,
      role_id: 2,
    },
    {
      id: 185,
      export_code: 26,
      role_id: 2,
    },
    {
      id: 186,
      export_code: 27,
      role_id: 2,
    },
    {
      id: 187,
      export_code: 28,
      role_id: 2,
    },
    {
      id: 188,
      export_code: 29,
      role_id: 2,
    },
    {
      id: 189,
      export_code: 30,
      role_id: 2,
    },
    {
      id: 190,
      export_code: 31,
      role_id: 2,
    },
    {
      id: 191,
      export_code: 32,
      role_id: 2,
    },
    {
      id: 192,
      export_code: 33,
      role_id: 2,
    },
    {
      id: 193,
      export_code: 34,
      role_id: 2,
    },
    {
      id: 194,
      export_code: 35,
      role_id: 2,
    },
    {
      id: 195,
      export_code: 36,
      role_id: 2,
    },
    {
      id: 196,
      export_code: 37,
      role_id: 2,
    },
    {
      id: 197,
      export_code: 38,
      role_id: 2,
    },
    {
      id: 198,
      export_code: 23,
      role_id: 3,
    },
    {
      id: 199,
      export_code: 24,
      role_id: 3,
    },
    {
      id: 200,
      export_code: 25,
      role_id: 3,
    },
    {
      id: 201,
      export_code: 26,
      role_id: 3,
    },
    {
      id: 202,
      export_code: 27,
      role_id: 3,
    },
    {
      id: 203,
      export_code: 28,
      role_id: 3,
    },
    {
      id: 204,
      export_code: 29,
      role_id: 3,
    },
    {
      id: 205,
      export_code: 30,
      role_id: 3,
    },
    {
      id: 206,
      export_code: 31,
      role_id: 3,
    },
    {
      id: 207,
      export_code: 32,
      role_id: 3,
    },
    {
      id: 208,
      export_code: 33,
      role_id: 3,
    },
    {
      id: 209,
      export_code: 34,
      role_id: 3,
    },
    {
      id: 210,
      export_code: 35,
      role_id: 3,
    },
    {
      id: 211,
      export_code: 36,
      role_id: 3,
    },
    {
      id: 212,
      export_code: 37,
      role_id: 3,
    },
    {
      id: 213,
      export_code: 38,
      role_id: 3,
    },
    {
      id: 214,
      export_code: 40,
      role_id: 1,
    },
    {
      id: 215,
      export_code: 40,
      role_id: 2,
    },
    {
      id: 216,
      export_code: 40,
      role_id: 3,
    },
    {
      id: 217,
      export_code: 41,
      role_id: 1,
    },
    {
      id: 218,
      export_code: 41,
      role_id: 2,
    },
    {
      id: 219,
      export_code: 41,
      role_id: 3,
    },
    {
      id: 220,
      export_code: 42,
      role_id: 1,
    },
    {
      id: 221,
      export_code: 42,
      role_id: 2,
    },
    {
      id: 222,
      export_code: 42,
      role_id: 3,
    },
    {
      id: 223,
      export_code: 43,
      role_id: 1,
    },
    {
      id: 224,
      export_code: 43,
      role_id: 2,
    },
    {
      id: 225,
      export_code: 43,
      role_id: 3,
    },
    {
      id: 226,
      export_code: 44,
      role_id: 1,
    },
    {
      id: 227,
      export_code: 44,
      role_id: 2,
    },
    {
      id: 228,
      export_code: 44,
      role_id: 3,
    },
    {
      id: 229,
      export_code: 45,
      role_id: 1,
    },
    {
      id: 230,
      export_code: 45,
      role_id: 2,
    },
    {
      id: 231,
      export_code: 45,
      role_id: 3,
    },
    {
      id: 232,
      export_code: 46,
      role_id: 1,
    },
    {
      id: 233,
      export_code: 46,
      role_id: 2,
    },
    {
      id: 234,
      export_code: 46,
      role_id: 3,
    },
    {
      id: 235,
      export_code: 47,
      role_id: 1,
    },
    {
      id: 236,
      export_code: 47,
      role_id: 2,
    },
    {
      id: 237,
      export_code: 47,
      role_id: 3,
    },
    {
      id: 238,
      export_code: 48,
      role_id: 1,
    },
    {
      id: 239,
      export_code: 48,
      role_id: 2,
    },
    {
      id: 240,
      export_code: 48,
      role_id: 3,
    },
    {
      id: 241,
      export_code: 49,
      role_id: 1,
    },
    {
      id: 242,
      export_code: 49,
      role_id: 2,
    },
    {
      id: 243,
      export_code: 49,
      role_id: 3,
    },
    {
      id: 244,
      export_code: 50,
      role_id: 1,
    },
    {
      id: 245,
      export_code: 50,
      role_id: 2,
    },
    {
      id: 246,
      export_code: 50,
      role_id: 3,
    },
    {
      id: 247,
      export_code: 51,
      role_id: 1,
    },
    {
      id: 248,
      export_code: 51,
      role_id: 2,
    },
    {
      id: 249,
      export_code: 51,
      role_id: 3,
    },
    {
      id: 250,
      export_code: 52,
      role_id: 1,
    },
    {
      id: 251,
      export_code: 52,
      role_id: 2,
    },
    {
      id: 252,
      export_code: 52,
      role_id: 3,
    },
    {
      id: 253,
      export_code: 53,
      role_id: 1,
    },
    {
      id: 254,
      export_code: 53,
      role_id: 2,
    },
    {
      id: 255,
      export_code: 53,
      role_id: 3,
    },
    {
      id: 256,
      export_code: 54,
      role_id: 1,
    },
    {
      id: 257,
      export_code: 54,
      role_id: 2,
    },
    {
      id: 258,
      export_code: 54,
      role_id: 3,
    },
    {
      id: 259,
      export_code: 55,
      role_id: 1,
    },
    {
      id: 260,
      export_code: 55,
      role_id: 2,
    },
    {
      id: 261,
      export_code: 55,
      role_id: 3,
    },
    {
      id: 262,
      export_code: 56,
      role_id: 1,
    },
    {
      id: 263,
      export_code: 56,
      role_id: 2,
    },
    {
      id: 264,
      export_code: 56,
      role_id: 3,
    },
    {
      id: 265,
      export_code: 57,
      role_id: 1,
    },
    {
      id: 266,
      export_code: 57,
      role_id: 2,
    },
    {
      id: 267,
      export_code: 57,
      role_id: 3,
    },
    {
      id: 268,
      export_code: 58,
      role_id: 1,
    },
    {
      id: 269,
      export_code: 58,
      role_id: 2,
    },
    {
      id: 270,
      export_code: 58,
      role_id: 3,
    },
    {
      id: 271,
      export_code: 59,
      role_id: 1,
    },
    {
      id: 272,
      export_code: 59,
      role_id: 2,
    },
    {
      id: 273,
      export_code: 59,
      role_id: 3,
    },
    {
      id: 274,
      export_code: 60,
      role_id: 1,
    },
    {
      id: 275,
      export_code: 60,
      role_id: 2,
    },
    {
      id: 276,
      export_code: 60,
      role_id: 3,
    },
  ]
  await db.schema
    .createTable("export_roles")
    .addColumn("id", "bigint", (col) => col.primaryKey().autoIncrement())
    .addColumn("export_code", "bigint", (col) => col.notNull())
    .addColumn("role_id", "bigint", (col) => col.notNull())
    .$call(addTimestampColumns)
    .execute()
  await db.insertInto("export_roles").values(EXPORT_ROLES).execute()
}

export async function down(db: Kysely<Database>): Promise<void> {
  await db.schema.dropTable("export_roles").execute()
}
