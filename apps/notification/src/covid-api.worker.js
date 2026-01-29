const amqp = require('amqplib/callback_api')
const axios = require('axios')
const moment = require('moment')

const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'
const postCovidWorker = 'covid-api-update'
const getCovidWorker = 'covid-api-create'

const baseUrl = process.env.COVID_API_URL || ''
const covidToken = 'Basic ' + process.env.COVID_API_TOKEN || ''
const smileUrl = process.env.SMILE_URL
let headerCfg = {
  Authorization: '',
}

const { createCovidLogger } = require('./services/log.service')

const { testPayload } = require('./services/test.service')

// Consumer
function getAuth() {
  const loginUrl = baseUrl + '/user/login'
  const body = {
    username: process.env.COVID_API_USERNAME,
    password: process.env.COVID_API_PASSWORD,
  }
  return new Promise((resolve, reject) => {
    // let auth = myCache.get("covid-auth")
    // if(auth) {
    //   resolve(auth)
    // }
    axios({
      headers: {
        Authorization: covidToken,
      },
      method: 'POST',
      url: loginUrl,
      data: body,
    })
      .then((response) => {
        //   obj = { my: "Special", variable: 42 }
        let token = response.data.data
        // myCache.set("covid-auth", token, 432000)
        resolve(token)
      })
      .catch((error) => reject(error))
  })
}

const updateCovidData = () => {
  amqp.connect(amqServer, { frameMax: 1048576 }, function (error0, connection) {
    if (error0) {
      throw error0
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1
      }
      channel.assertQueue(postCovidWorker, {
        durable: true,
      })

      console.log(
        ' [*] Waiting for messages in %s. To exit press CTRL+C',
        postCovidWorker
      )
      channel.prefetch(1)
      channel.consume(
        postCovidWorker,
        function (msg) {
          console.log(' [x] Received %s', msg.content.toString())
          if (msg != null && baseUrl) {
            // get covid data & create
            console.log(' new worker detected at ' + postCovidWorker)
            const { endpoint, body, token } = JSON.parse(msg.content.toString())
            let updateUrl = baseUrl + '/smile' + endpoint

            let updateLog = {
              worker_name: postCovidWorker,
              payload: body,
              order_id: body.order_id,
              url: updateUrl,
            }

            getAuth()
              .then(function (auth) {
                headerCfg.Authorization = 'Bearer ' + auth
                let smileHeader = { Authorization: 'Bearer ' + token }

                axios({
                  headers: headerCfg,
                  method: 'POST',
                  url: updateUrl,
                  data: body,
                }).then(async function (response) {
                  // update flag kpcpen in order
                  // token
                  await axios({
                    headers: smileHeader,
                    method: 'PUT',
                    url: smileUrl + '/order/' + body.order_id + '/submitKPCPEN',
                  })
                    .then(function () {
                      console.log('Success update order covid submitKPCPEN')
                      // channel.ack(msg)
                    })
                    .catch((error) => {
                      console.log('error')
                      return Error(error)
                    })
                  updateLog.res_body = response.data
                  updateLog.res_status = response.status

                  createCovidLogger(updateLog)
                })
              })
              .catch((error) => {
                updateLog.res_body = error.response.data
                updateLog.res_status = error.response.status

                createCovidLogger(updateLog)
                console.warn(error)
              })

            channel.ack(msg)
          }
        },
        {
          noAck: false,
        }
      )
    })
  })
}

const createCovidData = () => {
  amqp.connect(amqServer, { frameMax: 1048576 }, function (error0, connection) {
    if (error0) {
      throw error0
    }
    connection.createChannel(function (error1, channel) {
      if (error1) {
        throw error1
      }
      channel.assertQueue(getCovidWorker, {
        durable: true,
      })

      console.log(
        ' [*] Waiting for messages in %s. To exit press CTRL+C',
        getCovidWorker
      )

      channel.consume(
        getCovidWorker,
        function (msg) {
          console.log(' [x] Received %s', msg.content.toString())
          if (msg != null && baseUrl) {
            // get covid data & create
            console.log(' new worker detected at ' + getCovidWorker)
            processDistribution(JSON.parse(msg.content.toString())).then(() => {
              channel.ack(msg)
            })
          }
        },
        {
          noAck: false,
        }
      )
    })
  })
}

async function processDistribution(payload) {
  const {
    endpoint,
    smile_token,
    order_items,
    is_allocated,
    master_order_id,
    fieldQty = 'JUMLAH_SASARAN',
  } = payload
  const smileHeader = { Authorization: 'Bearer ' + smile_token }
  // const distributeUrl = baseUrl + '/smile' + endpoint
  const distributeUrl = endpoint

  let createLog = {
    worker_name: getCovidWorker,
    payload: '{}',
    order_id: master_order_id,
    url: distributeUrl,
  }

  console.log('-Start Distribution')
  console.log(new Date())

  getAuth()
    .then(async function (auth) {
      headerCfg.Authorization = 'Bearer ' + auth
      const response = await axios({
        headers: headerCfg,
        method: 'GET',
        url: distributeUrl,
      })

      createLog.res_body = response.data
      createLog.res_status = response.status
      await createCovidLogger(createLog)

      if (response.status == 200) {
        console.log('--Get qty per entities from KPCP ' + endpoint)
        try {
          const { data } = response.data
          const batches = order_items[0].batches
          batches.sort((a, b) => (a.qty > b.qty ? 1 : b.qty > a.qty ? -1 : 0))
          data.sort((a, b) =>
            b[fieldQty] > a[fieldQty] ? 1 : a[fieldQty] > b[fieldQty] ? -1 : 0
          )
          for (let i = 0; i < data.length; i++) {
            let orderCovidData = {
              customer_code: data[i].KODE_FASKES
                ? data[i].KODE_FASKES
                : data[i].KODE_KABKOTA,
              estimated_date: moment().add(7, 'days').format('YYYY-MM-DD'),
              order_items: [
                {
                  material_code: order_items[0].material_code,
                },
              ],
              qty_kpcpen: data[i][fieldQty],
              master_order_id: master_order_id,
              is_kpcpen: 1,
            }
            let selectedBatch = []
            if (batches && batches.length > 0) {
              // order by biggest batch
              selectedBatch = await filterBatch(
                batches,
                parseInt(data[i][fieldQty])
              )
              orderCovidData.order_items[0].batches = selectedBatch
            } else {
              orderCovidData.order_items[0].qty = data[i][fieldQty]
            }
            console.log(selectedBatch)
            if (is_allocated) {
              orderCovidData.is_allocated = true
            }
            setTimeout(function () {
              console.log('---Kirim API COVID ' + i + '')
              console.log(new Date())
              console.log(JSON.stringify(orderCovidData))

              let smileCreateUrl = smileUrl + '/order/covid'

              let distributeLog = {
                worker_name: 'covid-smile-distribute',
                payload: orderCovidData,
                order_id: master_order_id,
                url: smileCreateUrl,
              }

              axios({
                headers: smileHeader,
                method: 'POST',
                url: smileCreateUrl,
                data: orderCovidData,
              })
                .then(function (response) {
                  distributeLog.res_body = response.data
                  distributeLog.res_status = response.status
                  createCovidLogger(distributeLog)
                  console.log('Success create order covid ')
                })
                .catch((error) => {
                  distributeLog.res_body = error
                  distributeLog.res_status = '500'
                  createCovidLogger(distributeLog)

                  console.log('error')
                  return Error(error)
                })
            }, i * 5000)
          }
        } catch (error) {
          // distributeLog.res_body = error.response.data
          // distributeLog.res_status = error.response.status
          // createCovidLogger(distributeLog)

          console.log(error)
          return Error(error)
        }
      }
    })
    .catch((error) => console.warn(error))
}

const filterBatch = (batches = [], finalQty = 0) => {
  let total = 0
  let reduceQty = JSON.parse(JSON.stringify(finalQty))
  let selectedBatch = null
  let finalBatch = []
  do {
    let availBatch = batches.filter((item) => item.qty > 0)
    if (availBatch.length > 0) {
      selectedBatch = JSON.parse(JSON.stringify(availBatch[0]))
    } else {
      selectedBatch = null
    }

    if (!selectedBatch) {
      break
    }
    if (selectedBatch.qty >= reduceQty) {
      selectedBatch.qty = reduceQty
    }

    finalBatch.push(selectedBatch)
    total += selectedBatch.qty
    reduceQty = reduceQty - selectedBatch.qty

    batches.forEach(function (batch) {
      if (batch.code === selectedBatch.code) {
        batch.qty = batch.qty - selectedBatch.qty
      }
    })
  } while (total < finalQty)
  return finalBatch
}

const testingBatch = {
  batches: [
    {
      code: 'BATCHCODE123',
      expired_date: '2021-12-31',
      production_date: '2020-12-31',
      manufacture_name: 'Biofarma',
      qty: 12000,
    },
  ],
  // batches: [
  //   {
  //     code: "202009005",
  //     expired_date: "2023-09-30",
  //     production_date: "2020-12-31",
  //     manufacture_name: "biofarma",
  //     qty:5000
  //   },
  //   {
  //     code: "2020090034",
  //     expired_date: "2023-09-30",
  //     production_date: "2020-12-31",
  //     manufacture_name: "biofarma",
  //     qty: 2001
  //   },
  //   {
  //     code: "202009007",
  //     expired_date: "2023-09-30",
  //     production_date: "2020-12-31",
  //     manufacture_name: "biofarma",
  //     qty: 47080
  //   }
  // ],
  reduceValue: [2460, 1907, 3297, 2136, 2486],
}

const testBatch = function () {
  console.log(moment().add(7, 'days').format('YYYY-MM-DD'))
  const { batches, reduceValue } = testingBatch
  // batches.sort(
  //   (a,b) => (a.expired_date > b.expired_date) ? 1 : ((b.expired_date > a.expired_date) ? -1 : 0)
  // )
  batches.sort((a, b) => (a.qty > b.qty ? 1 : b.qty > a.qty ? -1 : 0))
  reduceValue.sort((a, b) => (b > a ? 1 : a > b ? -1 : 0))
  let selectedBatch = []
  for (let i = 0; i < reduceValue.length; i++) {
    let filteredBatch = filterBatch(batches, reduceValue[i])
    selectedBatch.push({ total: reduceValue[i], batches: filteredBatch })
    console.log('-----selected batch----')
    console.log('total:' + reduceValue[i])
  }
}

const testingPayload = {
  endpoint:
    'http://kpcpen-api-dev.vsan-apps.playcourt.id/api/kpcpen/v1/smile/provinsi/distribusi/kabkota/31',
  smile_token:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NSwidXNlcm5hbWUiOiJ1c2VydGVzdF8xNjA2NzI3MzEwNjQ4IiwiaWF0IjoxNjExOTExMjE4LCJleHAiOjE2MTI1MTYwMTh9.Fwt7eILZ0qGVyK5AkM9AWsHc1XVzSsLhnBeRXAaSBW8',
  order_items: [
    {
      material_code: 'SINOVAC',
      batches: [
        {
          code: 'BATCHCODE123',
          expired_date: '2021-12-31',
          production_date: '2020-12-31',
          manufacture_name: 'Biofarma',
          qty: 5000,
        },
      ],
      // qty: 100
    },
  ],
  qty_kpcpen: 0,
  is_kpcpen: 1,
  fieldQty: 'JUMLAH_PENERIMA',
  // master_order_id:
}

const testCreateCovidWorker = () => {
  console.log('Prepare connection to rabbitmq')
  testPayload(getCovidWorker, testingPayload)
}

const testDistribution = function () {
  processDistribution(testingPayload)
}

module.exports = {
  updateCovidData,
  createCovidData,
  testBatch,
  testDistribution,
  testCreateCovidWorker,
}
