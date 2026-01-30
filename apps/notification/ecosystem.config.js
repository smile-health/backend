const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const env = process.env.NODE_ENV || 'development'
let productionWorker = []
if (env != 'development') {
  productionWorker = [
    {
      name: 'updateCovidWorker',
      args: 'updateCovidData',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'createCovidWorker',
      args: 'createCovidData',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'BPOMSaranaWorker',
      args: 'updateSaranaBPOM',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'orderBPOMWorker',
      args: 'orderBPOMWorker',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'transactionBPOMWorker',
      args: 'transactionBPOMWorker',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    // {
    //   name: 'retryBPOM',
    //   args: 'retryBPOM',
    //   script: "src/index.js",
    //   instances: 1,
    //   exec_mode: 'fork',
    //   cron_restart: "0 * * * *",
    //   watch: false,
    //   autorestart: false
    // },
  ]
}

module.exports = {
  apps: [
    ...productionWorker,
    {
      name: 'emailWorker',
      args: 'consumeEmail',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'smsWorker',
      args: 'consumeSms',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'biofarma-worker',
      args: 'consumeBiofarma',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'coldstorage-worker',
      args: 'consumeColdStorage',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'httpWorker',
      args: 'consumeHttp',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'multiNotifWorker',
      args: 'consumeNotification',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'fcmWorker',
      args: 'consumeFirebase',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'whatsappWorker',
      args: 'consumeWhatsapp',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
    {
      name: 'stopNotifWorker',
      args: 'stopNotifications',
      exec_mode: 'fork',
      watch: false,
      script: 'src/index.js',
      instances: '1',
    },
  ],
  error_file: 'err.log',
  out_file: 'out.log',
  log_file: 'combined.log',
  time: true,
}
