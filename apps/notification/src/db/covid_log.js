'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class CovidLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate() {
      // define association here
    }
  }
  CovidLog.init(
    {
      order_id: DataTypes.BIGINT,
      url: DataTypes.TEXT,
      payload: DataTypes.TEXT,
      res_body: DataTypes.TEXT,
      worker_name: DataTypes.STRING,
      res_status: DataTypes.INTEGER,
    },
    {
      sequelize,
      modelName: 'CovidLog',
      tableName: 'covid_logs',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  )
  return CovidLog
}
