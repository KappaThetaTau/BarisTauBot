//
// Created by Kunal Sheth on 3/29/22.
//

#ifndef BARISTAUBOT_PROTOCOL_H
#define BARISTAUBOT_PROTOCOL_H

#include <cstdint>

typedef packed_struct pour_message {
    uint8_t line;
    uint32_t flow_duration_msec;
} pour_message_t;

typedef packed_struct feedback_message {
    uint8_t line;

    uint8_t capacitance_before;
    int32_t start_latency_msec;
    uint8_t capacitance_during;
    int32_t stop_latency_msec;
    uint8_t capacitance_after;
} feedback_message_t;

typedef packed_struct install_message {
    uint8_t line;
    uint8_t capacitance_threshold;
} install_message_t;

#endif //BARISTAUBOT_PROTOCOL_H
