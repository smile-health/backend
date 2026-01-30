'use strict'
const { Model } = require('sequelize')
module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate() {
      // define association here
    }
  }
  Notification.init(
    {
      user_id: DataTypes.BIGINT,
      message: DataTypes.STRING,
      province_id: DataTypes.INTEGER,
      regency_id: DataTypes.INTEGER,
      entity_id: DataTypes.INTEGER,
      type: DataTypes.STRING,
      media: DataTypes.STRING,
      title: DataTypes.STRING,
      read_at: DataTypes.DATE,
      action_url: DataTypes.STRING,
      download_url: DataTypes.STRING,
      mobile_phone: DataTypes.STRING,
      patient_id: DataTypes.BIGINT,
      event_code: DataTypes.STRING(10),
      program_id: DataTypes.BIGINT,
      data: DataTypes.JSON,
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'notifications',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  )
  return Notification
}
