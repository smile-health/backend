const axios = require('axios')
const { createHttpLogger } = require('./log.service')

exports.handleHttpRequest = (
  channel,
  msg,
  url,
  method,
  headers,
  data,
  callback
) => {
  this.sendHttp(url, method, headers, data)
    .then((res) => {
      if (callback) {
        let callbackData = {}
        if (callback.fromResponse) {
          callbackData[callback.fromResponse.toField] = findNestedObj(
            res.data,
            callback.fromResponse.fromField
          )
        } else {
          callbackData = callback.data || {}
        }
        this.sendHttp(
          callback.url,
          callback.method,
          callback.headers,
          callbackData
        ).then(() => {
          channel.ack(msg)
        })
      } else {
        channel.ack(msg)
      }
    })
    .catch(() => {
      channel.ack(msg)
    })
}

function findNestedObj(obj, search) {
  let split = search.split('.')

  let findVal = null
  let lastVal = split[split.length - 1]
  if (split.length < 1) {
    findVal = obj[search]
  }
  for (let i = 0; i < split.length; i++) {
    if (obj[lastVal]) {
      findVal = obj[lastVal]
    } else {
      obj = obj[split[i]]
    }
  }
  return findVal
}

exports.sendHttp = (url, method, headers = {}, body) => {
  return new Promise((resolve, reject) => {
    let updateLog = {
      method: method,
      payload: body,
      url: url,
    }
    const options = {
      url: url,
      headers: headers,
      data: body,
      method: method,
    }
    axios(options)
      .then((response) => {
        updateLog.res_body = response.data
        updateLog.res_status = response.status
        createHttpLogger(updateLog)
        resolve(response)
      })
      .catch((error) => {
        let response = error.response
        updateLog.res_body = response ? response.data : 'undefined'
        updateLog.res_status = response ? response.status : 500

        createHttpLogger(updateLog)
        reject(error)
      })
  })
}
