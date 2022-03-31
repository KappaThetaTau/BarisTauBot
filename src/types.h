//
// Created by Kunal Sheth on 3/29/22.
//

#ifndef BARISTAUBOT_TYPES_H
#define BARISTAUBOT_TYPES_H

#include "stdbool.h"
#include "stdint.h"
#include "time.h"

#define packed_struct struct __attribute__((packed))

#define LEN(arr) (sizeof(arr) / sizeof(*(arr)))

#define NUM_LINES 10
#define IS_VALID_LINE(x) (0 <= (x) && (x) < NUM_LINES)

typedef uint16_t sensor_value_t;

typedef struct sample {
    sensor_value_t reading;
    time_t stamp;
} sample_t;

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

typedef enum result {
    SUCCESS = 0, FAILIURE = 1 // bool
} result_t;

#endif //BARISTAUBOT_TYPES_H
