//
// Created by Kunal Sheth on 3/29/22.
//

// all capacitive pins:
// 0, 2, 4, 12, 13, 14, 15, 27, 32, 33

// all servo pins:
// 2, 4, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33

// servo - cap:
// 5 (might be buggy, weak pullup)
// 16, 17, 18, 19, 21, 22, 23, 25, 26

#include "state.h"

#define DEFAULT_LINE_STATE (line_state_t) {.sensor.threshold = 50}
static line_state_t lines[10] = {
        DEFAULT_LINE_STATE,
        DEFAULT_LINE_STATE,
        DEFAULT_LINE_STATE,
        DEFAULT_LINE_STATE,
        DEFAULT_LINE_STATE,
        DEFAULT_LINE_STATE,
        DEFAULT_LINE_STATE,
        DEFAULT_LINE_STATE,
        DEFAULT_LINE_STATE,
        DEFAULT_LINE_STATE,
};
#undef DEFAULT_LINE_STATE

void install_line(uint8_t line, sensor_value_t threshold) {
    if (!(0 <= line && line <= LEN(lines))) return; // todo: report error

#define zero_sample (sample_t) {.reading = 0, .stamp  = 0}
    for (int i = 0; i < LEN(lines); i++) {
        lines[i].valve.last_open = 0;
        lines[i].valve.last_close = 0;
        lines[i].sensor.last_dry = zero_sample;
        lines[i].sensor.last_wet = zero_sample;
        lines[i].sensor.current = zero_sample;

        lines[i].sensor.threshold = threshold;
    }
#undef zero_sample
}

bool update_sensor_state(const uint8_t line, const sample_t latest, feedback_message_t *const msg) {
    if (!(0 <= line && line <= LEN(lines))) return false; // todo: report error

    struct line_sensor *const s = &lines[line].sensor;
    struct line_valve *const v = &lines[line].valve;

    // SENSOR STATE PROPERTIES
    const bool is_wet = latest.reading >= s->threshold;

    sample_t *const matching_sample = is_wet ? &s->last_wet : &s->last_dry;
    sample_t *const opposite_sample = is_wet ? &s->last_dry : &s->last_wet;

    const bool first_time_in_state = matching_sample->stamp == 0;
    const bool just_transitioned = opposite_sample->stamp > matching_sample->stamp;

    const unsigned rolling_avg = ((unsigned) matching_sample->reading + latest.reading) / 2;

    // GENERATE FEEDBACK MESSAGE
    bool valid_feedback_message =
            // trigger on drying edge
            !is_wet && just_transitioned &&
            // confirm necessary events have all happened
            v->last_open && v->last_close &&
            s->last_dry.stamp && s->last_wet.stamp &&
            latest.stamp &&
            // confirm valid order of events
            v->last_open < v->last_close &&
            v->last_close < latest.stamp;

    if (valid_feedback_message)
        *msg = (feedback_message_t) {
                .line = line,
                .capacitance_before = s->last_dry.reading,
                .start_latency_msec = s->last_dry.stamp - v->last_open,
                .capacitance_during = s->last_wet.reading,
                .stop_latency_msec = s->last_wet.stamp - v->last_close,
                .capacitance_after = latest.reading
        };

    // MUTATE STATE
    s->current = latest;
    matching_sample->stamp = latest.stamp;
    matching_sample->reading = first_time_in_state || just_transitioned ?
                               latest.reading : rolling_avg;

    return valid_feedback_message;
}

void update_valve_state(uint8_t line, time_t stamp, valve_position_t position) {
    if (!(0 <= line && line <= LEN(lines))) return; // todo: report error

    struct line_valve *const v = &lines[line].valve;

    if (position == OPEN) v->last_open = stamp;
    if (position == CLOSE) v->last_close = stamp;
}
