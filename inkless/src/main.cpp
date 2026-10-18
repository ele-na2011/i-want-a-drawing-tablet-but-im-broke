#include <Arduino.h>

void setup() {
  pinMode(9, OUTPUT);
  digitalWrite(9, LOW);
  Serial.begin(115200);
}

void loop() {
  while (Serial.available() > 0) {
    char command = Serial.read();

    if (command == '1') digitalWrite(9, HIGH);
    if (command == '0') digitalWrite(9, LOW);
  }
}