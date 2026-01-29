const { consumeBiofarma } = require('./biofarma.worker')
const {
  updateSaranaBPOM,
  orderBPOMWorker,
  transactionBPOMWorker,
} = require('./bpom-api.worker')
const { consumeColdStorage } = require('./coldstorage.worker')
const { updateCovidData, createCovidData } = require('./covid-api.worker')
const { consumeEmail } = require('./email.worker')
const { consumeFirebase } = require('./fcm.worker')
const { consumeHttp } = require('./http.worker')
const { consumeNotification } = require('./multiNotification.worker')
const { consumeSms } = require('./sms.worker')
const { stopNotifications } = require('./stop-notifications.worker')
const { consumeWhatsapp } = require('./whatsapp.worker')

module.exports = {
  consumeEmail,
  updateCovidData,
  createCovidData,
  consumeSms,
  consumeWhatsapp,
  consumeHttp,
  consumeBiofarma,
  consumeColdStorage,
  updateSaranaBPOM,
  orderBPOMWorker,
  transactionBPOMWorker,
  // retryBPOM,
  consumeNotification,
  consumeFirebase,
  stopNotifications,
  startAllWorkers: () => {
    consumeBiofarma()
    consumeColdStorage()
    consumeEmail()
    consumeFirebase()
    consumeHttp()
    consumeNotification()
    consumeSms()
    stopNotifications()
    consumeWhatsapp()

    if (process.env.NODE_ENV !== 'development') {
      updateCovidData()
      createCovidData()
      updateSaranaBPOM()
      orderBPOMWorker()
      transactionBPOMWorker()
    }
  }
}

require('make-runnable')
