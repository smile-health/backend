const axios = require('axios')

const SERVERNAME = process.env.SMS_SERVERNAME
const USERNAME = process.env.SMS_USERNAME
const PASSWORD = process.env.SMS_PASSWORD

exports.sendSms = (mobile, message) => {
  const url =
    SERVERNAME +
    '/Send.php?' +
    'username=' +
    USERNAME +
    '&' +
    'mobile=' +
    encodeURIComponent(mobile) +
    '&' +
    'message=' +
    encodeURIComponent(message) +
    '&' +
    'password=' +
    PASSWORD

  return new Promise((resolve, reject) => {
    axios
      .post(url)
      .then((response) => resolve(response))
      .catch((error) => reject(error))
  })
}
