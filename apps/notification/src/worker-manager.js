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

const STARTUP_DELAY_MS = 2000

const workers = [
  { name: 'emailWorker', fn: consumeEmail },
  { name: 'smsWorker', fn: consumeSms },
  { name: 'biofarma-worker', fn: consumeBiofarma },
  { name: 'coldstorage-worker', fn: consumeColdStorage },
  { name: 'httpWorker', fn: consumeHttp },
  { name: 'multiNotifWorker', fn: consumeNotification },
  { name: 'fcmWorker', fn: consumeFirebase },
  { name: 'whatsappWorker', fn: consumeWhatsapp },
  { name: 'stopNotifWorker', fn: stopNotifications },
]

const productionWorkers = [
  { name: 'updateCovidWorker', fn: updateCovidData },
  { name: 'createCovidWorker', fn: createCovidData },
  { name: 'BPOMSaranaWorker', fn: updateSaranaBPOM },
  { name: 'orderBPOMWorker', fn: orderBPOMWorker },
  { name: 'transactionBPOMWorker', fn: transactionBPOMWorker },
]

const activeWorkers = []

async function startWorkerWithDelay(worker, index) {
  await new Promise(resolve => setTimeout(resolve, index * STARTUP_DELAY_MS))
  try {
    console.log(`[${new Date().toISOString()}] Starting worker: ${worker.name}`)
    const result = worker.fn()
    
    if (result && typeof result.catch === 'function') {
      result.catch(error => {
        console.error(`[${new Date().toISOString()}] Unhandled error in worker ${worker.name}:`, error)
      })
    }
    
    activeWorkers.push(worker.name)
    console.log(`[${new Date().toISOString()}] Worker started: ${worker.name}`)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error starting worker ${worker.name}:`, error.message)
    console.error(error.stack)
  }
}

async function startAllWorkers() {
  console.log(`[${new Date().toISOString()}] Starting all workers with ${STARTUP_DELAY_MS}ms stagger...`)

  const allWorkers = [...workers]
  if (process.env.NODE_ENV !== 'development') {
    allWorkers.push(...productionWorkers)
  }

  const promises = allWorkers.map((worker, index) => startWorkerWithDelay(worker, index))
  await Promise.all(promises)

  console.log(`[${new Date().toISOString()}] All workers started. Active: ${activeWorkers.join(', ')}`)
}

function setupGracefulShutdown() {
  const signals = ['SIGTERM', 'SIGINT']
  signals.forEach(signal => {
    process.on(signal, () => {
      console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down gracefully...`)
      process.exit(0)
    })
  })
}

async function main() {
  setupGracefulShutdown()
  await startAllWorkers()
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

module.exports = { startAllWorkers }
