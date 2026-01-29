'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class WhatsappLog extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate() {
      // define association here
    }
  }
  WhatsappLog.init(
    {
      worker_name: DataTypes.STRING,
      url: DataTypes.TEXT,
      request_body: DataTypes.TEXT,
      response_body: DataTypes.TEXT,
      response_status_code: DataTypes.INTEGER,
      response_status_text: DataTypes.STRING,
      method: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: 'WhatsappLog',
      tableName: 'whatsapp_logs',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  )
  return WhatsappLog
}
