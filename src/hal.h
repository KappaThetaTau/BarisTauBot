//
// Created by Kunal Sheth on 3/30/22.
//

#ifndef BARISTAUBOT_HAL_H
#define BARISTAUBOT_HAL_H

#include "types.h"
#include "protocol.h"

result_t init_hal();

result_t valve_hal(uint8_t line, valve_position_t out);

result_t sensor_hal(uint8_t line, sensor_value_t *in);

#endif //BARISTAUBOT_HAL_H
