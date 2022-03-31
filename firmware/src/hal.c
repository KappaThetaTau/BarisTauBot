//
// Created by Kunal Sheth on 3/30/22.
//

#include <esp32-hal-ledc.h>
#include <driver/touch_pad.h>
#include "hal.h"
#include "math.h"

// all capacitive pins:
// 0, 2, 4, 12, 13, 14, 15, 27, 32, 33

// all servo pins:
// 2, 4, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33

// servo - cap:
// 5 (might be buggy, weak pullup)
// 16, 17, 18, 19, 21, 22, 23, 25, 26

#define SERVO_FRAME_PERIOD_US 20000.0
#define SERVO_MIN_PULSE_US     1000.0
#define SERVO_MAX_PULSE_US     2500.0
#define SERVO_RANGE_DEG         180.0

// desired resolution  = 500us
// 20000us ÷ 500us     = 40 steps
// 2^6                 = 64 steps
// 64 steps            > 40 steps
// -----------------------------
// min resolution_bits = 6
#define TIMER_BIT_DEPTH 8
#define TIMER_STEPS     256

#define CAPACITANCE_FILTER_MS 50

typedef struct line_hardware {
    const uint8_t valve_pin;
    const touch_pad_t sensor_pin;
    // todo: add open / close angles
} line_hardware_t;

static const line_hardware_t lines[NUM_LINES] = {
        {.valve_pin =  5, .sensor_pin = TOUCH_PAD_NUM0}, // pad 0 is gpio  4
        {.valve_pin = 16, .sensor_pin = TOUCH_PAD_NUM1}, // pad 1 is gpio  0
        {.valve_pin = 17, .sensor_pin = TOUCH_PAD_NUM2}, // pad 2 is gpio  2
        {.valve_pin = 18, .sensor_pin = TOUCH_PAD_NUM3}, // pad 3 is gpio 15
        {.valve_pin = 19, .sensor_pin = TOUCH_PAD_NUM4}, // pad 4 is gpio 13
        {.valve_pin = 21, .sensor_pin = TOUCH_PAD_NUM5}, // pad 5 is gpio 12
        {.valve_pin = 22, .sensor_pin = TOUCH_PAD_NUM6}, // pad 6 is gpio 14
        {.valve_pin = 23, .sensor_pin = TOUCH_PAD_NUM7}, // pad 7 is gpio 27
        {.valve_pin = 25, .sensor_pin = TOUCH_PAD_NUM8}, // pad 8 is gpio 33
        {.valve_pin = 26, .sensor_pin = TOUCH_PAD_NUM9}, // pad 9 is gpio 32
};

static unsigned deg_to_pulse_us(double deg) {
    static const double us_per_degree = (SERVO_MAX_PULSE_US - SERVO_MIN_PULSE_US) / SERVO_RANGE_DEG;
    return (unsigned) round(deg * us_per_degree + SERVO_MIN_PULSE_US);
}

static uint32_t pulse_width_to_native_dc(unsigned us) {
    if (us < SERVO_MIN_PULSE_US) us = SERVO_MIN_PULSE_US;
    if (us > SERVO_MAX_PULSE_US) us = SERVO_MAX_PULSE_US;

    static const double us_per_step = (SERVO_FRAME_PERIOD_US / TIMER_STEPS);
    return (uint32_t) round(us / us_per_step);
}

static double us_to_hz(double us) {
    return 1E6 / us;
}

static uint8_t line_to_pwm_channel(uint8_t line) {
    if (!IS_VALID_LINE(line)) return -1;
    else return line;
}

static uint8_t pwm_channel_to_line(uint8_t pwm) {
    if (!IS_VALID_LINE(pwm)) return -1;
    else return pwm;
}

result_t init_hal() {
    if (touch_pad_init()/* != ESP_OK*/ ||
        touch_pad_set_fsm_mode(TOUCH_FSM_MODE_TIMER) ||
        touch_pad_intr_disable() ||
        // touch_pad_set_voltage(TOUCH_HVOLT_2V7, TOUCH_LVOLT_0V5, TOUCH_HVOLT_ATTEN_1V);
        // touch_pad_set_meas_time(???, ???);
        touch_pad_filter_start(CAPACITANCE_FILTER_MS))
        return FAILIURE;

    for (int ln = 0; ln < LEN(lines); ln++) {
        const auto pad = lines[ln].sensor_pin;
        if (touch_pad_config(pad, 0) ||
            touch_pad_set_cnt_mode(pad, TOUCH_PAD_SLOPE_7, TOUCH_PAD_TIE_OPT_LOW))
            return FAILIURE;

        const auto channel = line_to_pwm_channel(ln);
        ledcSetup(channel, us_to_hz(SERVO_FRAME_PERIOD_US), TIMER_BIT_DEPTH);
        ledcAttachPin(lines[ln].valve_pin, channel);
        ledcWrite(channel, pulse_width_to_native_dc(deg_to_pulse_us(90)));
    }

    return SUCCESS;
}

result_t valve_hal(uint8_t line, valve_position_t out) {
    if (!IS_VALID_LINE(line)) return FAILIURE;
    ledcWrite(
            line_to_pwm_channel(line),
            pulse_width_to_native_dc(deg_to_pulse_us(/*todo: map to open / close angle*/))
    );
    return SUCCESS;
}

result_t sensor_hal(uint8_t line, sensor_value_t *in) {
    if (!IS_VALID_LINE(line)) return FAILIURE;
    return touch_pad_read_filtered(lines[line].sensor_pin, in) ?
           FAILIURE : SUCCESS;
}