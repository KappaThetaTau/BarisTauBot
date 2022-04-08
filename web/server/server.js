// TODO: alert admins/kunal with line number that ran out / other significant errors
// TODO: ping RPI *and* ping ESP32s
// TODO: shouldn't need to text ORDER again for a new order. old link still tied to phone number
require('dotenv').config();
const fs = require('fs');
const logger = require('./logger.js');
const PROD = process.env.ENV == 'PROD';
const store = require('data-store')({ path: process.cwd() + '/db.json' }, {
  'ingredients': require('./ingredients.js'),
  'paused': false,
  'orders': {},
  'orders by user': {},
  'bottles': { 0: '', 1: '', 2: '', 3: '', 4: '', 5: '', 6: '', 7: '', 8: '', 9: '' },
  'sidToPhone': {},
  'servo angles': { 0: [180, 0], 1: [180, 0], 2: [180, 0], 3: [180, 0], 4: [180, 0], 5: [180, 0], 6: [180, 0], 7: [180, 0], 8: [180, 0], 9: [180, 0] }, // [open, closed]
  'capacitance thresholds': { 0: 1000, 1: 1000, 2: 1000, 3: 1000, 4: 1000, 5: 1000, 6: 1000, 7: 1000, 8: 1000, 9: 1000 }
});
const twilio = require('./twilio.js');
const { UID_REGEX_PATTERN, orderExists, createOrder, submitOrder, generateUID } = require('./helpers.js');
const express = require('express');
const app = express();
const http = require('http');
const https = require('https');
const httpServer = http.createServer(app);
const httpsServer = PROD ? https.createServer({
    key: fs.readFileSync('/etc/letsencrypt/live/baristau.me/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/baristau.me/fullchain.pem'),
  }, app) : null;
const cors = require('cors');
const { Server } = require('socket.io');
const io = new Server(PROD ? httpsServer : httpServer);
const port = 3000;
const session = require('express-session');
const RedisStore = require("connect-redis")(session);
const { createClient } = require("redis");
let redisClient = createClient({ legacyMode: true });
redisClient.connect().catch(console.error);

const BASE_URL = process.env.BASE_URL;
logger.sys(`Base url is ${BASE_URL}`);
var codes = {};

var rawData = [];

rpiSocket = false;
const CUP_VOLUME = 200; // mL
logger.sys(`Cup volume is ${CUP_VOLUME} mL`);

const admins = require('./admins.js');

loadSave();

setInterval(save, 60 * 1000); // save every 60s

function save() {
  logger.debug(`Saving state to db.json`);
  store.set('ingredients', all_ingredients);
  store.set('paused', orders_paused);
  store.set('orders', orders);
  store.set('orders by user', ordersByUser);
  store.set('bottles', bottles);
  store.set('bottles', bottles);
  store.set('servo angles', servoAngles);
  store.set('capacitance thresholds', capacitanceThresholds);
}

function loadSave() {
  all_ingredients = store.get('ingredients');
  orders_paused = store.get('paused');
  orders = store.get('orders');
  ordersByUser = store.get('orders by user');
  bottles = store.get('bottles');
  available_ingredients = Object.values(bottles).filter(x => x);
  sidToPhone = store.get('sidToPhone');
  servoAngles = store.get('servo angles');
  capacitanceThresholds = store.get('capacitance thresholds');
}

var sessionMiddleware = session({
  store: new RedisStore({client: redisClient}),
  resave: false,
  saveUninitialized: true,
  secret: 'kasjdlkasjdlkasj'
});

if (PROD) {
  app.use(cors());

  app.use((req, res, next) => {
    if (!req.secure) return res.redirect(`https://${req.headers.host}${req.url}`);
    next();
  });
}

app.use(sessionMiddleware);

app.use(express.json());
app.use(express.urlencoded({extended:false}))

app.use(express.static('../public'));

app.get('/admin', (req, res) => {
  res.sendFile(`admin.html`, { root: `${__dirname}/../public` });
});

app.get(`/:orderID(${UID_REGEX_PATTERN})`, (req, res) => {
  let orderID = req.params.orderID;
  if (!orderExists(orderID)) return res.redirect('/');
  res.sendFile(`index.html`, { root: `${__dirname}/../public` });
});

app.post(`/order/:orderID(${UID_REGEX_PATTERN})`, (req, res) => {
  let orderID = req.params.orderID;
  let [drinkName, drinkIngredients] = [req.body.name, req.body.ingredients];
  if (!orderExists(orderID) || typeof drinkName !== 'string' || !Array.isArray(drinkIngredients)) return res.status(400).send('Request not formatted correctly');
  if (orders_paused) return res.status(400).send('Ordering is currently paused');
  let ratioSum = 0;
  drinkIngredients = drinkIngredients.filter(x => x.name && x.ratio).map(x => { return { name: x.name, ratio: x.ratio } });
  for (x of drinkIngredients) {
    let name = x.name;
    let ratio = x.ratio;
    ratioSum += ratio;
    // 'ratio' key must be a number with at most 2 decimal places (to avoid floating point errors with sum)
    if (!ratio || isNaN(ratio) || ratio != ratio.toFixed(2)) return res.sendStatus(400);
    if (!name) return res.status(400).send('Drink name not supplied');
    if (!available_ingredients.includes(name)) return res.status(417).send('One or more of the ingredients are out of stock');
  }
  if (!drinkIngredients.length) return res.status(400).send('No ingredients supplied');
  if (ratioSum != 1) return res.status(400).send('Ingredient ratios do not sum to 100%');
  submitOrder(orderID, drinkName, drinkIngredients);
  adminNS.emit('queue update', formatQueue());
  logger.info(`Order for "${drinkName}" placed by ${orders[orderID].user}`);
  res.sendStatus(200);
});

app.post('/sms', (req, res) => {
  let from = req.body.From;
  let body = req.body.Body;
  if (req.body.ping) return res.sendStatus(200); // ping
  else if (!from || !body) return res.sendStatus(400);
  logger.debug(`SMS received from ${from} with body: ${body}`);

  let response = '';
  if (Object.values(codes).includes(body.trim())) {
    for (let sid of Object.keys(codes)) {
      if (codes[sid] == body.trim()) {
        codes[sid] = from;
        break;
      }
    }
    response = 'Number successfully tied to session';
  } else if (body.toLowerCase() === 'order') {
    let orderID = createOrder(from);
    response = `${BASE_URL}/${orderID}`;
  }
  else if (body.toLowerCase() === 'status') {
    let userOrders = ordersByUser[from];
    for (orderID of userOrders) {
      let order = orders[orderID];
      response += `Your ${order.drink.name} is ${order.status == 'created' ? 'still in the queue!' : '???'}\n`;
    }
    response = response.trim();
  }

  if (!response) return;
  res.writeHead(200, {'Content-Type': 'text/xml'});
  logger.debug(`Replying to ${from} with message: ${response}`);
  res.end(twilio.generateReply(response));
});

const adminNS = io.of('/admin');
const userNS = io.of('/');
const rpiNS = io.of('/rpi');

adminNS.use(function(socket, next) {
  sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// no idea why i did adminNS.use instead of doing this on connect
adminNS.use((socket, next) => {
  let id = socket.request.session.id;
  let phone = sidToPhone[id];
  if (!phone && codes[id] && codes[id][0] == '+') {
    phone = sidToPhone[id] = codes[id];
    delete codes[id];
  }
  if (!phone) {
    let sids = Object.keys(codes);
    let code = false;
    if (!sids.includes(id)) {
      code = generateUID([], 6); // TODO: make sure this is unique
      codes[id] = code;
    } else {
      code = codes[id];
    }
    // throw new Error(`Text ${code} to 231-BAR-ISTA to gain admin rights.`); /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  }
  // if (!admins.includes(phone)) throw new Error('You are not an admin.'); /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  next();
});

userNS.on('connection', socket => {
  // console.log('A user connected.');
  socket.emit('available ingredients', available_ingredients);
});

function makeDrink(drink) {
  logger.info(`Making drink: ${drink.name}`);
  for (let ing of drink.ingredients) {
    let line_index;
    for (let line of Object.keys(bottles)) {
      if (bottles[line] == ing.name) {
        line_index = line;
        break;
      }
    }
    if (!line_index) throw new Error(`Error trying to make drink. Ingredient "${ing.name}" not in a bottle.`);

    let vol = CUP_VOLUME * ing.ratio; // mL
    let rate = all_ingredients[ing.name].rate; // mL/s

    let flow_duration = vol / rate * 1000;

    logger.debug(`Pour request for "${ing.name}" on line ${line_index} (zero-indexed) for ${flow_duration}ms`);

    if (!rpiSocket) {
      logger.err(`Raspberry Pi socket not connected. Cannot send pour request to line ${line_index}`);
    } else {
      rpiSocket.emit('pour request', { line_index, flow_duration });
    }
  }
}

rpiNS.on('connection', socket => {
  if (socket.handshake.auth.token !== '_G`8z"vGu]4m)y}C') {
    console.log(socket.handshake.auth);
    console.log('Unauthorized RPI connection attempt');
    return socket.disconnect();
  }
  logger.sys('Raspberry Pi connected.');
  rpiSocket = socket;
  // makeDrink();

  socket.on('dump', data => {
    for (let ack of data) {
      let m = ack.match(/([0-9a-f]{2,4})/g);
      if (!m || m.length != 3) return logger.warn(`Invalid dump: ${ack}`);
      let [line, cap, state] = m.map(x => parseInt(x, 16));
      rawData[line] = {cap, state: state ? 'Closed' : 'Open'};
    }
    adminNS.emit('data update', rawData);
  });

  socket.emit('connection acknowledged');

  socket.on('disconnect', () => {
    logger.sys('Raspberry Pi disconnected.');
    rpiSocket = false;
  });
});

function formatQueue() {
  return Object.keys(orders).filter(x => orders[x].status && orders[x].status == 'created').map(x => {
    let val = orders[x];
    return {
      id: x,
      from: val.user,
      drink: val.drink.name,
      time: val.time
    };
  });
}

adminNS.on('connection', socket => {
  // console.log(socket.request.session);
  logger.debug('An admin connected.');

  socket.emit('queue update', formatQueue());
  socket.emit('data update', rawData);

  socket.on('approve order', id => {
    logger.debug(`Order #${id} approved`);
    makeDrink(orders[id].drink);
    delete orders[id];
    // todo: send status update SMS / change order status
    adminNS.emit('queue update', formatQueue());    
  });
  socket.on('reject order', id => {
    delete orders[id];
    logger.debug(`Order #${id} rejected`);
    // todo: send status update SMS / change order status
    adminNS.emit('queue update', formatQueue());
  });

  socket.on('quick pour', line => {
    if (!rpiSocket) {
      logger.err(`Raspberry Pi socket not connected. Cannot quick pour on line ${line}`);
    } else {
      rpiSocket.emit('pour request', { line_index: parseInt(line), flow_duration: 250 });
    }
  });

  socket.on('fetch all ingredients', callback => {
    callback(all_ingredients);
    socket.emit('bottle statuses', bottles);
  });

  socket.on('fetch servo angles', callback => {
    callback(servoAngles);
  });

  socket.on('update bottles', bottles_ => {
    if (JSON.stringify(bottles_) !== JSON.stringify(bottles)) logger.debug(`Bottle configuration updated`);
    bottles = bottles_;
    available_ingredients = Object.values(bottles).filter(x => x);
  });

  socket.on('update servo angles', angles => {
    if (JSON.stringify(angles) !== JSON.stringify(servoAngles)) logger.debug(`Servo angles updated`);
    for (let i in Object.keys(angles)) {
      let [new_open, new_closed] = angles[i];
      let [old_open, old_closed] = servoAngles[i];
      if (new_open != old_open || new_closed != old_closed) {
        logger.debug(`Sending install request to line ${i}. Open: ${new_open} deg / Closed: ${new_closed} deg / Cap: ${capacitanceThresholds[i]}`);
        if (!rpiSocket) {
          logger.err(`Raspberry Pi socket not connected. Cannot send install request to line ${i}`);
        } else {
          rpiSocket.emit('install request', {line_index: parseInt(i), open: parseInt(new_open), closed: parseInt(new_closed), cap: parseInt(capacitanceThresholds[i])});
        }
      }
    }
    servoAngles = angles;
  });

  socket.on('update ingredients', json => {
    if (JSON.stringify(json) !== JSON.stringify(all_ingredients)) logger.debug(`Ingredients updated`);
    all_ingredients = json;
  });

  socket.on('set pause', pause => {
    orders_paused = pause;
    logger.sys(`Orders ${pause ? 'paused' : 'unpaused'}!`);
  });

  socket.on('pause status', callback => {
    callback(orders_paused);
  });

  socket.on('robot ping', callback => {
    callback(!!rpiSocket);
  });
});

httpServer.listen(PROD ? 80 : port, () => {
  if (!PROD) logger.sys(`Server listening on port ${port}`);
});

if (PROD) {
  httpsServer.listen(443, () => {
    logger.sys(`Server listening on port 443`);
  });
}