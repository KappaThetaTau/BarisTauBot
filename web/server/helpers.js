const twilio = require('./twilio.js');
const UID_REGEX = /^[a-zA-Z0-9]+$/;
const UID_REGEX_PATTERN = '[a-zA-Z0-9]{4}';

function generateUID(ids, len=4) {
	let id = '';
	for (let i = 0; i < len; i++) {
		id += String.fromCharCode(Math.floor(48 + Math.random()*74));
	}
	if (ids.includes(id) || !UID_REGEX.test(id)) return generateUID(ids, len);
	return id;
}

function orderExists(orderID) {
	// console.log(orders);
	return !!orders[orderID];
}

function createOrder(from) {
	let orderID = generateUID(Object.keys(orders));
    orders[orderID] = {user: from, time: Date.now()};
    if (!ordersByUser[from]) ordersByUser[from] = [];
    ordersByUser[from].push(orderID);
    return orderID;
}

function submitOrder(orderID, drinkName, drinkIngredients) {
	let order = orders[orderID];
	order.drink = {
		name: drinkName,
    	ingredients: drinkIngredients
    };
    order.status = 'created';
    twilio.sendSMS(`Order #${orderID} received!\nText STATUS for updates!`, order.from);
}

module.exports = {UID_REGEX_PATTERN, orderExists, createOrder, submitOrder, generateUID };