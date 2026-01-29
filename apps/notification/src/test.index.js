const { testSarana, testSaranaBPOMWorker } = require('./bpom-api.worker')
const {
  testDistribution,
  testBatch,
  testCreateCovidWorker,
} = require('./covid-api.worker')
const { testEmail, testEmailWorker } = require('./email.worker')
const { testHttp } = require('./http.worker')
const { testMultiNotif } = require('./multiNotification.worker')
const { testSms, testSMSWorker } = require('./sms.worker')

module.exports = {
  testEmailWorker,
  testEmail,
  testSms,
  testDistribution,
  testBatch,
  testCreateCovidWorker,
  testSMSWorker,
  testHttp,
  testSarana,
  testSaranaBPOMWorker,
  testMultiNotif,
}

require('make-runnable')
