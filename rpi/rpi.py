# uint8 line_index (0-9), uint32 flow_duration ms (250-10000)
def generate_pour_request(line_index, flow_duration):
	line_bytes = bytes('{:02x}'.format(line_index), 'ascii')
	duration_bytes = bytes('{:08x}'.format(flow_duration), 'ascii')
	return b'P ' + line_bytes + b' ' + duration_bytes + b'\n'

# returns (line_index, capacitance_before, start_latency_msec, capacitance_during, stop_latency_msec, capacitance_after)
def parse_feedback_response(res):
	s = res.decode('ascii')
	li = int(s[2:4], 16)
	cap_before = int(res[5:9], 16)
	start_lat = int(res[10:18], 16)
	cap_during = int(res[19:23], 16)
	stop_lat = int(res[24:32], 16)
	cap_after = int(res[33:37], 16)
	return (li, cap_before, start_lat, cap_during, stop_lat, cap_after)

# uint8 line_index (0-9), uint16 capacitance_threshold (0-65535)
def generate_install_request(line_index, cap_thresh):
	line_bytes = bytes('{:02x}'.format(line_index), 'ascii')
	cap_bytes = bytes('{:04x}'.format(cap_thresh), 'ascii')
	return b'I ' + line_bytes + b' ' + cap_bytes + b'\n'

# (line_index, capacitance_before, start_latency_msec, capacitance_during, stop_latency_msec, capacitance_after) = parse_feedback_response(b'F 09 0a9f 00000ff1 0b9a 00000fad 0aaf')
# print(line_index)
# print(generate_pour_request(9,0))
print(generate_install_request(7, 8451))