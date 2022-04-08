import socketio

sio = socketio.Client()
sio.connect('http://localhost:3000', namespaces=['/rpi'], auth={'token': '_G`8z"vGu]4m)y}C'})

# @sio.event(namespace='/rpi')
@sio.event
def connect(): # doesn't fire?
	print("I'm connected!")
	# print('my sid is', sio.sid)

@sio.event
def connect_error(data):
	print("The connection failed!")

@sio.event
def disconnect(data):
	print("I'm disconnected!")

@sio.on('*')
def catch_all(event, data):
	pass