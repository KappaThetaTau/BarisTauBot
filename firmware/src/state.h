//
// Created by Kunal Sheth on 3/29/22.
//

#ifndef BARISTAUBOT_STATE_H
#define BARISTAUBOT_STATE_H

#include "types.h"
#include "protocol.h"

void install_line(uint8_t line, sensor_value_t threshold);

bool update_sensor_state(uint8_t line, sample_t latest, feedback_message_t *msg);

void update_valve_state(uint8_t line, time_t stamp, valve_position_t position);

#endif //BARISTAUBOT_STATE_H
