import { env } from "process";

export const databaseConfig = {
  host: env.DB_HOST || "localhost",
  port: parseInt(env.DB_PORT || "3306", 10),
  user: env.DB_USER || "root",
  password: env.DB_PASSWORD || "",
  name: env.DB_NAME || "smile_auth",
  connectionLimit: parseInt(env.DB_CONNECTION_LIMIT || "10", 10),
  debug: env.APP_DEBUG === "true",
};
