import { config } from "@dotenvx/dotenvx"
import { parseEnv, z, port } from "znv"

config({ path: ".env" })

export const env = parseEnv(process.env, {
  NODE_ENV: z
    .enum(["production", "development", "test"])
    .default("development"),
  PORT: port().default(3008),
  TIMEOUT: z.number().positive().default(60),
  LOG_MODE: z
    .enum(["production", "development", "test"])
    .default("development"),

  APP_NAME: z.string().default("SMILE Warehouse"),
  APP_KEY: z.string().min(1),
  APP_DEBUG: z.boolean().default(true),
  APP_URL: z.string().default("http://localhost"),

  FRONTEND_URL: z.string().optional(),
  FALLBACK_SERVER_URL: z.string().optional(),
  CORE_API_URL: z.string(),
  WORKSPACE_ID: z.number().default(1),

  DB_HOST: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PORT: port(),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),

  REDIS_HOST: z.string().min(1),
  REDIS_PASSWORD: z.string(),
  REDIS_PORT: port(),
  ENABLE_CACHE: z.boolean().default(false),
  REDIS_TTL: z.number().positive().default(60),

  RABBITMQ_PROTOCOL: z.string().min(1).default("amqp"),
  RABBITMQ_HOST: z.string().min(1),
  RABBITMQ_PORT: port(),
  RABBITMQ_USERNAME: z.string().min(1),
  RABBITMQ_PASSWORD: z.string().min(1),
  RABBITMQ_VHOST: z.string().default("/"),

  MAIL_HOST: z.string().min(1),
  MAIL_PORT: z.number(),
  MAIL_USERNAME: z.string().min(1),
  MAIL_PASSWORD: z.string().min(1),
  MAIL_FROM_NAME: z.string(),
  MAIL_FROM_ADDRESS: z.string().min(1),

  OTLP_ENDPOINT: z.string().optional(),
  CLICKHOUSE_DATABASE_URL: z.string().min(1),

  // Minio
  MINIO_ENDPOINT: z.string().min(1).optional(),
  MINIO_PORT: port().optional(),
  MINIO_ACCESS_KEY: z.string().min(1).optional(),
  MINIO_SECRET_KEY: z.string().min(1).optional(),
  MINIO_USE_SSL: z
    .string()
    .default("false")
    .transform((val) => val.toLowerCase() === "true"),
  MINIO_REGION: z.string().default("ap-southeast-3"),
  MINIO_PART_SIZE: z.number().min(1).default(10), // 10MB

  // Export Excel
  EXPORT_EXCEL_BATCH_SIZE: z.number().optional(),
  EXPORT_EXCEL_BUCKET_NAME: z.string().optional(),
  EXPORT_EXCEL_EXPIRES_DAYS: z.number().optional(),

  // ClickHouse Tracing
  ENABLE_CLICKHOUSE_TRACING: z.boolean().default(false),
})

export default env
