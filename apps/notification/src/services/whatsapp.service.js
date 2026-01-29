const axios = require('axios')

let bodyTemplate = {
  to: '',
  type: 'template',
  template: {
    namespace: process.env.WHATSAPP_NAMESPACE,
    name: '',
    language: {
      policy: 'deterministic',
      code: 'id',
    },
    components: [
      {
        type: 'body',
        parameters: [],
      },
    ],
  },
}

exports.sendWhatsapp = async ({ phoneNumber, template, variables }) => {
  // set config
  const appId = process.env.WHATSAPP_APP_ID
  const secretKey = process.env.WHATSAPP_SECRET_KEY
  const url = process.env.WHATSAPP_URL

  // clear template at the first time
  clearBodyTemplate()

  // set body for each dynamic variables
  const body = setBodyTemplate(phoneNumber, template, variables)

  // set header
  const headers = {
    'Qiscus-App-Id': appId,
    'Qiscus-Secret-Key': secretKey,
    'Content-Type': 'application/json',
  }
  try {
    // hit api qiscus whatsapp
    const response = await axios({
      method: 'POST',
      url,
      headers,
      data: body,
    })
    return {
      url: url,
      body: body,
      response: response,
    }
  } catch (error) {
    return {
      url: url,
      body: body,
      response: error.response,
    }
  }
}

function setBodyTemplate(phoneNumber, template, variables) {
  // set phone number to body template
  bodyTemplate.to = phoneNumber
  // set template name to body template
  bodyTemplate.template.name = template
  // set variables to body template
  for (const v of variables) {
    bodyTemplate.template.components[0].parameters.push({
      type: 'text',
      text: v.toString(),
    })
  }
  return bodyTemplate
}

function clearBodyTemplate() {
  // clear phone number to body template
  bodyTemplate.to = ''
  // clear template name to body template
  bodyTemplate.template.name = ''
  // clear variables to body template
  bodyTemplate.template.components[0].parameters = []
  return
}
