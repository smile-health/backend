const dotenv = require('dotenv')

dotenv.config()

module.exports = {
  development: {
    username: process.env.DEV_DB_USERNAME,
    password: process.env.DEV_DB_PASSWORD,
    database: process.env.DEV_DB_DATABASE,
    host: process.env.DEV_DB_HOST,
    port: process.env.DEV_DB_PORT,
    dialect: process.env.DEV_DB_DIALECT,
    logging: true,
  },
  test: {
    username: process.env.TEST_DB_USERNAME,
    password: process.env.TEST_DB_PASSWORD,
    database: process.env.TEST_DB_DATABASE,
    host: process.env.TEST_DB_HOST,
    port: process.env.TEST_DB_PORT,
    dialect: process.env.TEST_DB_DIALECT,
    dialectOptions: {
      socketPath: process.env.TEST_DB_SOCKET,
    },
    logging: true,
  },
  production: {
    username: process.env.PROD_DB_USERNAME,
    password: process.env.PROD_DB_PASSWORD,
    database: process.env.PROD_DB_DATABASE,
    host: process.env.PROD_DB_HOST,
    port: process.env.PROD_DB_PORT,
    dialect: process.env.PROD_DB_DIALECT,
    logging: false,
    pool: {
      max: parseInt(process.env.PROD_DB_MAX_POOL) || 5,
      min: 0,
      idle: parseInt(process.env.PROD_DB_IDLE_POOL) || 10000,
      acquire: parseInt(process.env.PROD_DB_ACQUIRE_POOL) || 60000,
    },
  },
}
