var socket = io('/admin');

socket.on('connect_error', err => {
	if (err.message === 'xhr poll error') return;
	document.body.remove();
	setTimeout(() => alert(err.message), 50);
});

const NUM_BOTTLES = 10;
var bottleContainer = document.querySelector('.container.bottle');
var servoContainer = document.querySelector('.container.servo');
var dataContainer = document.querySelector('.container.data');
var pauseBtn = document.querySelector('.pause');

var collapseBtns = Array.from(document.querySelectorAll('.collapsible'));
var textArea = document.querySelector('textarea');

for (let btn of collapseBtns) {
	btn.addEventListener('click', () => {
		btn.classList.toggle('active');
		let content = btn.nextElementSibling;
		content.style.display = content.style.display == 'block' ? 'none' : 'block';
	});
}

refresh();

function refresh() {
	socket.emit('fetch all ingredients', ingredients => {
		bottleContainer.innerHTML = '';
		for (var i = 0; i < NUM_BOTTLES; i++) {
			var selectHTML = `<span><span>Line ${i}: </span><select name="line${i}" id="line${i}"><option value=''>--- Empty ---</option></span>`;
			for (let x of Object.keys(ingredients)) {
				selectHTML += `<option>${x}</option>`;
			}
			selectHTML += `</select><br>`;
			bottleContainer.innerHTML += selectHTML;
		}

		textArea.value = ingredientsAsString(ingredients);
	});
	socket.emit('fetch servo angles', angles => {
		servoContainer.innerHTML = '';
		for (var i = 0; i < NUM_BOTTLES; i++) {
			var inputHTML = `Line ${i} Open Angle <input id="line${i}open" type="number" min="0" max="180" step="1" value="180"><br>Line ${i} Closed Angle <input id="line${i}closed" type="number" min="0" max="180" step="1" value="0"><br><br>`;
			servoContainer.insertAdjacentHTML('beforeEnd', inputHTML);
		}
	});
	socket.emit('pause status', paused => {
		pauseBtn.innerText = paused ? 'Unpause Orders' : 'Pause Orders';
	});
}

function ingredientsAsString(json) {
	let str = '';
	for (let x of Object.keys(json)) {
		str += `${x}, ${json[x].rate}\n`;
	}
	return str.trim();
}

function ingredientsAsJSON(str) {
	let arr = str.split('\n');
	let json = {};
	for (let x of arr) {
		let _ = x.split(',').map(i => i.trim());
		if (_.length != 2 || isNaN(_[1])) return false;
		let [name, rate] = _;
		rate = parseFloat(rate);
		json[name] = { rate };
	}
	return json;
}

function togglePause() {
	let paused = pauseBtn.innerText === 'Pause Orders';
	socket.emit('set pause', paused);
	pauseBtn.innerText = paused ? 'Unpause Orders' : 'Pause Orders';
}

socket.on('bottle statuses', bottles => {
	window.bottles = bottles;
	for (let key of Object.keys(bottles)) {
		let select = document.querySelector(`[name=line${key}]`);
		let opts = Array.from(select.options);
		for (let opt of opts) {
			if (opt.value == bottles[key]) {
				opt.selected = true;
				break;
			}
		}
	}
});

function createQueueTable(queue) {
	let tbody = document.querySelector('.container.queue table tbody');
	tbody.innerHTML = '<tr><th>From</th><th>ID</th><th>Drink</th><th>Placed</th><th></th></tr>';
	for (let item of queue) {
		tbody.insertAdjacentHTML('beforeEnd', `<tr><td>${item.from}</td><td>${item.id}</td><td>${item.drink}</td><td>${timeAgo(item.time)}</td><td><button>👍</button><button>👎</button></td></tr>`);
		let [approveBtn, rejectBtn] = tbody.lastChild.querySelectorAll('button');
		approveBtn.addEventListener('click', () => {
			socket.emit('approve order', item.id);
		});
		rejectBtn.addEventListener('click', () => {
			socket.emit('reject order', item.id);
		});
	}
}
socket.on('queue update', queue => {
	createQueueTable(queue);
});

function createDataTable(data) {
	let tbody = document.querySelector('.container.data table tbody');
	tbody.innerHTML = '<tr><th>Line</th><th>Capacitance</th><th>State</th><th>250ms Pour</th></tr>';
	for (let i in data) {
		let item = data[i];
		if (!item) item = {line: '?', cap: '?', state: '?'};
		tbody.insertAdjacentHTML('beforeEnd', `<tr><td>${i}</td><td>${item.cap}</td><td>${item.state}</td><td style="display: flex; justify-content: center;"><button style="background: lightblue">💦</button></td></tr>`);
		let btn = tbody.lastChild.querySelector('button');
		btn.addEventListener('click', () => {
			socket.emit('quick pour', i);
		});
	}
}
socket.on('data update', data => {
	createDataTable(data);
});

function update() {
	for (let key of Object.keys(bottles)) {
		let select = document.querySelector(`[name=line${key}]`);
		let opt = select.selectedOptions[0];
		bottles[key] = opt.value;
	}

	let ingredientsJSON = ingredientsAsJSON(textArea.value);
	if (!ingredientsJSON) {
		alert('Error: Ingredients list not formatted properly.\nFormat: Drink name, rate');
		return;
	}

	let servoAngles = {};
	for (let key of Object.keys(bottles)) {
		let openInput = document.querySelector(`#line${key}open`);
		let closedInput = document.querySelector(`#line${key}closed`);
		let [open, closed] = [openInput.value, closedInput.value];
		servoAngles[key] = [open, closed];
	}

	socket.emit('update servo angles', servoAngles);
	socket.emit('update ingredients', ingredientsJSON);
	socket.emit('update bottles', bottles);
}

async function ping() {
	// ping robot
	socket.emit('robot ping', status => {
		updateStatus(status, null, null);
	});

	// ping twilio webhook
	var req = await fetch(`/sms`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ping: true }) });
	var res = await req.text();
	updateStatus(null, req.ok, null);
}

ping();
pingInterval = setInterval(ping, 10 * 1000) // update connection statuses every 10 seconds

socket.on('connect', () => {
	updateStatus(null, null, true);
});

socket.on('disconnect', () => {
	updateStatus(null, null, false);
});

function updateStatus(robot, sms, socket) {
	var robotStatus = document.querySelector('.header span:nth-of-type(1)');
	var smsStatus = document.querySelector('.header span:nth-of-type(2)');
	var socketStatus = document.querySelector('.header span:nth-of-type(3)');
	if (robot != null) {
		robotStatus.classList.remove(robot ? 'offline' : 'online');
		robotStatus.classList.add(robot ? 'online' : 'offline');	
	}
	if (sms != null) {
		smsStatus.classList.remove(sms ? 'offline' : 'online');
		smsStatus.classList.add(sms ? 'online' : 'offline');	
	}
	if (socket != null) {
		socketStatus.classList.remove(socket ? 'offline' : 'online');
		socketStatus.classList.add(socket ? 'online' : 'offline');	
	}
}

// "X minutes ago" from https://muffinman.io/blog/javascript-time-ago-function/
const MONTH_NAMES=["January","February","March","April","May","June","July","August","September","October","November","December"];function getFormattedDate(t,e=!1,a=!1){const r=t.getDate(),o=MONTH_NAMES[t.getMonth()],n=t.getFullYear(),u=t.getHours();let g=t.getMinutes();return g<10&&(g=`0${g}`),e?`${e} at ${u}:${g}`:a?`${r}. ${o} at ${u}:${g}`:`${r}. ${o} ${n}. at ${u}:${g}`}function timeAgo(t){if(!t)return null;const e="object"==typeof t?t:new Date(t),a=new Date,r=new Date(a-864e5),o=Math.round((a-e)/1e3),n=Math.round(o/60),u=a.toDateString()===e.toDateString(),g=r.toDateString()===e.toDateString(),$=a.getFullYear()===e.getFullYear();return o<5?"now":o<60?`${o} seconds ago`:o<90?"about a minute ago":n<60?`${n} minutes ago`:u?getFormattedDate(e,"Today"):g?getFormattedDate(e,"Yesterday"):$?getFormattedDate(e,!1,!0):getFormattedDate(e)}