const axios = require('axios')
const { JWT } = require('google-auth-library')

const GOOGLE_KEY = process.env.GOOGLE_KEY
const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID
const FCM_HTTP = `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages`

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/firebase.messaging',
]

async function getAccessToken() {
  return new Promise(function (resolve, reject) {
    const key = require(GOOGLE_KEY)
    const jwtClient = new JWT(
      key.client_email,
      null,
      key.private_key,
      SCOPES,
      null
    )
    jwtClient.authorize(function (err, tokens) {
      if (err) {
        reject(err)
        return
      }
      resolve(tokens.access_token)
      return tokens.access_token
    })
  })
}

exports.sendFCM = async ({ fcmToken, title, message }) => {
  console.log('====== sendFCM START')
  // set config
  const url = `${FCM_HTTP}:send`
  const authToken = await getAccessToken()

  // set header
  const headers = {
    Authorization: 'Bearer ' + authToken,
    'Content-Type': 'application/json',
  }

  // set body
  const body = {
    message: {
      token: fcmToken,
      notification: {
        title,
        body: message,
      },
      data: { title, body: message },
      android: {
        direct_boot_ok: true,
      },
    },
  }
  try {
    // hit api fcm
    console.log('====== sendFCM payload', {
      method: 'POST',
      url,
      headers,
      data: body,
    })
    const response = await axios({
      method: 'POST',
      url,
      headers,
      data: body,
    })
    console.log('====== sendFCM return', {
      response: response,
    })
    return {
      url: url,
      body: body,
      response: response,
    }
  } catch (error) {
    console.log('====== sendFCM Error', {
      url: url,
      body: body,
      response: error.response,
    })
    return {
      url: url,
      body: body,
      response: error.response,
    }
  }
}
