//
// Created by Kunal Sheth on 3/29/22.
//

#ifndef BARISTAUBOT_TYPES_H
#define BARISTAUBOT_TYPES_H

#include "stdint.h"
#include "time.h"

#define packed_struct struct __attribute__((packed))

#define LEN(arr) (sizeof(arr) / sizeof(*(arr)))

typedef uint8_t sensor_value_t;

typedef struct sample {
    sensor_value_t reading;
    time_t stamp;
} sample_t;

typedef struct line_hardware {
    const uint8_t valve_pin;
    const uint8_t sensor_pin;
} line_hardware_t;

typedef struct line_state {
    struct line_valve {
        time_t last_open;
        time_t last_close;
    } valve;
    struct line_sensor {
        sensor_value_t threshold;

        sample_t last_dry;
        sample_t last_wet;
        sample_t current;
    } sensor;
} line_state_t;

typedef enum valve_position {
    OPEN = 0, CLOSE = 1;
} valve_position_t;

#endif //BARISTAUBOT_TYPES_H
