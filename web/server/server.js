const twilio = require('./twilio.js');
const { UID_REGEX_PATTERN, orderExists, createOrder, submitOrder } = require('./helpers.js');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const port = 3000;

// orders = {
//   'Chjo': {
//     user: '+16305452222',
//     status: 'created'
//   }
// }
// ordersByUser = {
//   '+16305452222': ['Chjo']
// }
orders = {};
ordersByUser = {};
all_ingredients = ['Nesquik Powder', 'Milk', 'Orange Juice'];
bottles = {
  1: 'Nesquik Powder',
  2: 'Milk',
  3: 'Orange Juice',
  4: '', 5: '', 6: '', 7: '', 8: '', 9: ''
};
available_ingredients = Object.values(bottles).filter(x => x);

app.use(express.json());
app.use(express.urlencoded({extended:false}))

app.use(express.static('../public'));

app.get('/admin', (req, res) => {
  res.sendFile(`admin.html`, { root: `${__dirname}/../public` });
});

app.get(`/:orderID(${UID_REGEX_PATTERN})`, (req, res) => {
  let orderID = req.params.orderID;
  if (!orderExists(orderID)) return res.sendStatus(404);
  // res.send(orders[orderID]);
  res.sendFile(`index.html`, { root: `${__dirname}/../public` });
});

app.post(`/order/:orderID(${UID_REGEX_PATTERN})`, (req, res) => {
  let orderID = req.params.orderID;
  let [drinkName, drinkIngredients] = [req.body.name, req.body.ingredients];
  if (!orderExists(orderID) || typeof drinkName !== 'string' || !Array.isArray(drinkIngredients)) return res.status(400).send('Request not formatted correctly');
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
  // console.log('New order:', orderID, drinkName, drinkIngredients);
  res.sendStatus(200);
});

app.post('/sms', (req, res) => {
  let from = req.body.From;
  let body = req.body.Body;
  console.log(`Message from: ${from}\nContent: ${body}`);

  let response = '';
  if (body.toLowerCase() === 'order') {
    let orderID = createOrder(from);
    console.log(`Order ID ${orderID} generated for ${from}`);
    response = `http://038e-96-63-255-28.ngrok.io/${orderID}`;
  } else if (body.toLowerCase() === 'status') {
    let userOrders = ordersByUser[from];
    for (orderID of userOrders) {
      let order = orders[orderID];
      // response += `Order #${orderID} status: ${order.status}\n`;
      response += `Your ${order.drink.name} is ${order.status == 'created' ? 'still in the queue!' : '???'}\n`;
    }
    response = response.trim();
  }

  if (!response) return;
  res.writeHead(200, {'Content-Type': 'text/xml'});
  console.log(`Sending message: "${response}" to ${from}`);
  res.end(twilio.generateReply(response));
});

io.on('connection', socket => {
  console.log('A user connected.');
  socket.emit('available ingredients', available_ingredients);

  socket.on('fetch all ingredients', callback => {
    callback(all_ingredients);
    socket.emit('bottle statuses', bottles);
  });

  socket.on('update bottles', bottles_ => {
    bottles = bottles_;
  });
});

server.listen(port, () => {
  console.log(`Listening on port ${port}`);
});