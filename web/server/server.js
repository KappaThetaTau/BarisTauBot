const twilio = require('./twilio.js');
const {generateUID, UID_REGEX_PATTERN, orderExists} = require('./helpers.js');
const express = require('express');
const app = express();
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
ingredients = {
  'OJ': {},
  'Milk': {}
}
ingredient_names = Object.keys(ingredients);

app.use(express.json());
app.use(express.urlencoded({extended:false}))

app.use(express.static('../public'));

app.get(`/:orderID(${UID_REGEX_PATTERN})`, (req, res) => {
  let orderID = req.params.orderID;
  if (!orderExists(orderID)) return res.sendStatus(404);
  res.send(orders[orderID]);
});

app.post(`/order/:orderID(${UID_REGEX_PATTERN})`, (req, res) => {
  let orderID = req.params.orderID;
  let [drinkName, drinkIngredients] = [req.body.name, req.body.ingredients];
  console.log(orderID, drinkName, drinkIngredients);
  if (!orderExists(orderID) || typeof drinkName !== 'string' || typeof drinkIngredients !== 'object') return res.sendStatus(400);
  let ratioSum = 0;
  drinkIngredients = drinkIngredients.map(x => {
    let name = x.name;
    let ratio = x.ratio;
    ratioSum += ratio;
    // 'ratio' key must be a number with at most 2 decimal places (to avoid floating point errors with sum)
    if (!ratio || isNaN(ratio) || ratio != ratio.toFixed(2)) return res.sendStatus(400);
    // 'name' key must be a valid ingredient
    if (!name || !ingredient_names.includes(name)) return res.sendStatus(400);
    if (ingredients[name].empty) return res.sendStatus(417);
    return {name, ratio}; // re-assigning drinkIngredients to remove possible extra keys
  });
  if (ratioSum != 1) return res.sendStatus(400); 
  orders[orderID].drink = {
    name: drinkName,
    ingredients: drinkIngredients
  };
  orders[orderID].status = 'created';
  res.send(orders);
});

app.post('/sms', (req, res) => {
  let from = req.body.From;
  let body = req.body.Body;
  console.log(`Message from: ${from}\nContent: ${body}`);

  let response = '';
  if (body === 'order') {
    let orderID = generateUID(Object.keys(orders));
    orders[orderID] = {user: from};
    if (!ordersByUser[from]) ordersByUser[from] = [];
    ordersByUser[from].push(orderID);
    console.log(`Order ID ${orderID} generated for ${from}`);
    response = `http://f8c3-130-126-255-204.ngrok.io/${orderID}`;
  } else if (body === 'status') {
    let userOrders = ordersByUser[from];
    for (orderID of userOrders) {
      let order = orders[orderID];
      response += `Order #${orderID} status: ${order.status}\n`;
    }
    response = response.trim();
  }

  if (!response) return;
  res.writeHead(200, {'Content-Type': 'text/xml'});
  console.log(`Sending message: "${response}" to ${from}`);
  res.end(twilio.generateReply(response));
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});