var m = window.ORDER_ID = window.location.pathname.split('/')[1].match(/^([a-zA-Z0-9]{4})$/);
// window.ORDER_ID = false; // don't delete
window.ORDER_ID = m ? m[1] : false;

var socket = io();
var menu = document.querySelector('#menu');

if (!window.ORDER_ID) {
	let el = document.querySelector('.menu-container');
	el.innerHTML = 'Text ORDER to <a style="text-decoration: underline; color: inherit;" href="sms:1-231-227-4782&body=ORDER">231-BARISTA</a> to get started!';
}
socket.emit('invalid order?', window.ORDER_ID, invalid => {
	if (invalid) {
		let el = document.querySelector('.menu-container');
		el.innerHTML = 'Text ORDER to <a style="text-decoration: underline; color: inherit;" href="sms:1-231-227-4782&body=ORDER">231-BARISTA</a> to get started!';
	}
});

socket.on('available ingredients', ingredients => {
	while (menu.firstChild) menu.firstChild.remove();
	let availableDrinks = Object.keys(drinks).filter(x => {
		let ingredients_ = drinks[x].map(i => i.name);
		for (let i of ingredients_) {
			if (!ingredients.includes(i)) return false;
		}
		return true;
	});
	for (drink of availableDrinks) {
		menu.innerHTML += `<li><a href="#">${drink}</a></li>`;
	}
	var items = Array.from(menu.children);
	for (let i in items) {
		let item = items[i];
		item.addEventListener('click', () => {
			for (let item_ of items) {
				item_.classList.remove('selected');
			}
			item.classList.add('selected');
		});
	}
});

function search() {
  var input, filter, ul, li, a, i;
  input = document.getElementById("search");
  filter = input.value.toUpperCase();
  ul = document.getElementById("menu");
  li = ul.getElementsByTagName("li");
  for (i = 0; i < li.length; i++) {
    a = li[i].getElementsByTagName("a")[0];
    if (a.innerHTML.toUpperCase().indexOf(filter) > -1) {
      li[i].style.display = "";
    } else {
      li[i].style.display = "none";
    }
  }
}

function selectedDrink() {
	return document.querySelector('#menu li.selected') ? document.querySelector('#menu li.selected').innerText.trim() : false;
}

async function submit() {
	if (!ORDER_ID) return;

	var c1 = document.querySelector('.receipt-container');
	var c2 = document.querySelector('.menu-container');

	var drinkName = selectedDrink();
	if (!drinkName) return;

	var req = await fetch(`/order/${ORDER_ID}`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			name: drinkName,
			ingredients: drinks[drinkName]
		})
	});
	var res = await req.text();
	if (!req.ok) {
		// Note: this doesn't reset1
		c1.children[0].style.display = 'none';
		c1.children[1].innerText = 'Error';
		c1.children[2].innerText = res;
	}

	toggleVisibility(c1, 'flex');
	toggleVisibility(c2);
}

function toggleVisibility(el, disp='block') { el.style.display = el.style.display == 'none' ? disp : 'none'; }