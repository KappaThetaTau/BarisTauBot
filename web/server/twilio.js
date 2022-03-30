require('dotenv').config();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const twilio = require('twilio');
const MessagingResponse = twilio.twiml.MessagingResponse;
const client = new twilio(accountSid, authToken);

async function sendSMS(body='🤠', to='+16305452222', from='+12312274782') {
  let message = await client.messages.create({body, to, from});
  return message.sid;
}

function generateReply(body) {
  let twiml = new MessagingResponse();
  twiml.message(body);
  return twiml.toString();
}

module.exports = {sendSMS, generateReply};