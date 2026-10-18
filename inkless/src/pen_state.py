from dataclasses import dataclass
from enum import Enum


class PenState(str, Enum):
    CONTACT = "CONTACT"
    HOVER = "HOVER"
    LOST = "LOST"


@dataclass
class PenReading:
    tracking_ok: bool
    tip_height: float | None
    friction_detected: bool
    moving: bool


class PenStateDetector:
    def __init__(
        self,
        contact_height: float = 2.0,
        lift_height: float = 5.0,
    ):
        # Heights are simulated units for now.
        if not 0 <= contact_height < lift_height:
            raise ValueError(
                "Use 0 <= contact_height < lift_height."
            )

        self.contact_height = contact_height
        self.lift_height = lift_height
        self.state = PenState.LOST
        self.reason = "No readings yet."

    def update(self, reading: PenReading) -> PenState:
        """Process one reading and return the current pen state."""

        # Missing or invalid tracking always stops drawing.
        if (
            not reading.tracking_ok
            or reading.tip_height is None
            or not 0 <= reading.tip_height < float("inf")
        ):
            self.state = PenState.LOST
            self.reason = "Tracking or height measurement unavailable."

        # A clearly raised pen is hovering, even if there is sound.
        elif reading.tip_height >= self.lift_height:
            self.state = PenState.HOVER
            self.reason = "Pen is above the surface."

        # Preserve contact during a pause or small height fluctuations.
        elif self.state == PenState.CONTACT:
            self.reason = "Contact maintained; pen has not clearly lifted."

        # Start contact when the pen is close and friction is detected.
        elif (
            reading.tip_height <= self.contact_height
            and reading.friction_detected
            and reading.moving
        ):
            self.state = PenState.CONTACT
            self.reason = "Pen is close, moving, and friction is detected."

        else:
            self.state = PenState.HOVER
            self.reason = "Not enough evidence to start drawing."

        return self.state


def main():
    detector = PenStateDetector()

    # Simulated readings: no camera, microphone, or Arduino needed.
    examples = [
        ("Pen raised", PenReading(True, 12, False, True)),
        ("Writing begins", PenReading(True, 1, True, True)),
        ("Pen pauses on surface", PenReading(True, 1, False, False)),
        ("Pen lifts", PenReading(True, 10, False, True)),
        ("Tracking disappears", PenReading(False, None, False, False)),
    ]

    for label, reading in examples:
        state = detector.update(reading)
        print(f"{label}: {state.value}")
        print(f"  {detector.reason}")


if __name__ == "__main__":
    main()