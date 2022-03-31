#include <Arduino.h>

#define LED_BUILTIN 4

#include "types.h"
#include "protocol.h"

void setup() {
// write your initialization code here
    pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
// write your code here
    digitalWrite(LED_BUILTIN, HIGH);
    delay(2000);
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
}