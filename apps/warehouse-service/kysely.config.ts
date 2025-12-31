import "dotenv/config"
import { defineConfig } from "kysely-ctl"
import { createPool } from "mysql2"
import env from "./src/config/env"

export default defineConfig({
  dialect: "mysql2",
  dialectConfig: {
    pool: createPool({
      database: env.DB_NAME as string,
      host: env.DB_HOST as string,
      user: env.DB_USER as string,
      port: env.DB_PORT,
      password: env.DB_PASSWORD as string,
      connectionLimit: 10,
    }),
  },
  migrations: {
    migrationFolder: "./src/common/infrastructure/database/migrations",
  },
  seeds: {
    seedFolder: "./src/common/infrastructure/database/views",
  },
  plugins: [],
})
