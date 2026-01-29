'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class HttpLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate() {
      // define association here
    }
  }
  HttpLog.init(
    {
      url: DataTypes.TEXT,
      payload: DataTypes.TEXT,
      res_body: DataTypes.TEXT,
      worker_name: DataTypes.STRING,
      res_status: DataTypes.INTEGER,
      method: DataTypes.STRING,
      retry_status: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'HttpLog',
      tableName: 'http_logs',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  )
  return HttpLog
}
