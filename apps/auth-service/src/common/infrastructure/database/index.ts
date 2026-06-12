import { createPool, Pool } from "mysql2";
import { DatabaseManager } from "@smile-health/lib/database";
import { MysqlDialect } from "kysely";
import { Database } from "./types/db";
import { databaseConfig } from "../../../config/databaseConfig";

console.log(
  `🔌 Attempting to connect to MySQL database at ${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.name}...`
);

export const pool: Pool = createPool({
  database: databaseConfig.name,
  host: databaseConfig.host,
  user: databaseConfig.user,
  port: databaseConfig.port,
  password: databaseConfig.password,
  connectionLimit: databaseConfig.connectionLimit,
  timezone: "Z",
});

pool.on("connection", (connection) => {
  console.log(
    `✅ MySQL connection established as id ${connection.threadId} to ${databaseConfig.host}:${databaseConfig.port}`
  );
});

pool.on("error", (err) => {
  console.error(
    `❌ MySQL connection error to ${databaseConfig.host}:${databaseConfig.port}:`,
    err.message
  );
});

export const dialect = new MysqlDialect({
  pool,
});

export const db = new DatabaseManager<Database>(dialect, databaseConfig.debug).getDB();

// Auto-test connection on startup
export const testMySQLConnection = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    console.log(
      `🔍 Testing MySQL connection to ${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.name}...`
    );

    await new Promise<void>((resolve, reject) => {
      pool.getConnection((err, connection) => {
        if (err) {
          reject(err);
          return;
        }
        connection.ping((pingErr) => {
          connection.release();
          if (pingErr) {
            reject(pingErr);
          } else {
            resolve();
          }
        });
      });
    });

    console.log(`✅ MySQL connection test successful!`);
    return {
      success: true,
      message: `Successfully connected to MySQL at ${databaseConfig.host}:${databaseConfig.port}`,
      details: {
        database: databaseConfig.name,
        host: databaseConfig.host,
        port: databaseConfig.port,
      },
    };
  } catch (error: any) {
    console.error(`❌ MySQL connection test failed:`, error.message);
    return {
      success: false,
      message: `Failed to connect to MySQL: ${error.message}`,
      details: {
        errorCode: error.code,
        errorMessage: error.message,
        host: databaseConfig.host,
        port: databaseConfig.port,
        database: databaseConfig.name,
      },
    };
  }
};

testMySQLConnection()
  .then((result) => {
    if (result.success) {
      console.log(`🎉 Database connection verified: ${result.message}`);
    } else {
      console.error(`🚨 Database connection failed: ${result.message}`);
    }
  })
  .catch((error) => {
    console.error(`🚨 Database connection test error:`, error);
  });
