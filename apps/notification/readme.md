# SMILE Notification Service
This is SMILE Service Notification using PM2, RabbitMQ and SMTP Mail

## Usage 
Basic command
```bash
npm run start

npm run stop

npm run list
```

## Implementation
Available Notification Worker:

#### Email Notification
Worker Title: 'email-notification'

Example Payload:
```bash
{ mail: 'sender@email.com', subject: 'string', content: 'Email Content' }
```

#### SMS Notification
Worker Title: 'sms-notification'

Example Payload:
```bash
{ mobile: '', message: '' }
```

#### COVID API Integration
Worker Title: 'covid-api-update'

Example Payload:
```bash
{ endpoint: '/dinkes-provinsi', body: {'jsonBody'} }
```

Worker Title: 'covid-api-create'

Example Payload:
```bash
{ endpoint: '/kabkota/distribusi/faskes/:kode_kabkota', smile_token: 'token', order_items: [] }
```


#### HTTP Integration
Worker Title: 'http-worker'
Description: used for unmanaged request HTTP via pm2/rabbitMQ

Example Payload:
```bash
{ url: 'http://fullurl/etc', headers: {'headerJson'}, method: 'post/get/etc', data: {'jsonBody'}, callback: { url: '', headers: {}, methods: '', data: {}, fromResponse: {fromField: '', toField: ''}}}
```

#### BPOM API Integration
Worker Title: 'bpom-api-sarana'
Description: used for update data sarana BPOM

Example Payload:
```bash
{ url: 'http://fullurl/etc', headers: {'headerJson'}, data: {'jsonBody'}, smile_token: 'smile_token'}
```

#### Multi Notification
Worker Title: 'multi-notification'
Description: used for send notification to multi driver & recap in table notifications

Example: Payload:
```bash
{
  media: [
    'sms', 
    'fcm', 
    'email'
  ],
  user: {
    id: 29,
    email: 'email@badr-interactive.com',
    mobile_phone: '081234567890',
    fcm_token: 'AABB',
    province_id: 32,
    regency_id: null,
    entity_id: 3,
  },
  message: 'message to send',
  title: 'Notification Title',
  type: 'type',
  action_url: 'action url'
}
```

### Example Usage: 
Install amqlib 
```bash
npm i amqplib
```

Set up hostname in .env
```bash
AMQP_SERVER=''
```

Used it on your controller/services
```bash
const amqp = require('amqplib')

const amqServer = process.env.AMQP_SERVER || 'amqp://localhost'
const open = amqp.connect(amqServer).then(connection => connection.createChannel())
const worker = workerTitle //your worker title
const payload = { yourPayload }

amqp.connect(amqServer, function(error0, connection) {
  if (error0) {
    console.warn(error0)
  }
  if(connection) {
    connection.createChannel(function(error1, channel) {
      if (error1) {
        console.warn(error1)
      }
      if(channel) {
        channel.assertQueue(getCovidWorker, {
          durable: true
        })

        channel.sendToQueue(getCovidWorker, Buffer.from(JSON.stringify(testingPayload)));
        console.log(" [x] Sent %s", testingPayload) 
      }
    });

    setTimeout(function() { 
      connection.close()
    }, 500) 
  }
})
```

## Rabbit MQ
RabbitMQ Tutorials – https://www.rabbitmq.com/getstarted.html

Preparing rabbitMQ docker
```bash
docker run -d --hostname some-rabbit --name some-rabbit --network some-network -p 5672:5672 -e rabbitmq:3
```

## Other Docs
PM2 Docs – https://pm2.keymetrics.io/docs/usage/pm2-doc-single-page/