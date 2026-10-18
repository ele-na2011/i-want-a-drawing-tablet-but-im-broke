import unittest

from pen_state import PenReading, PenState, PenStateDetector


class TestPenState(unittest.TestCase):
    def setUp(self):
        # Each test starts with a fresh detector.
        self.detector = PenStateDetector()

    def read(self, height, friction=False, moving=False, tracking=True):
        return self.detector.update(
            PenReading(
                tracking_ok=tracking,
                tip_height=height,
                friction_detected=friction,
                moving=moving,
            )
        )

    def start_contact(self):
        self.assertEqual(
            self.read(1, friction=True, moving=True),
            PenState.CONTACT,
        )

    def test_movement_while_hovering(self):
        self.assertEqual(
            self.read(12, moving=True),
            PenState.HOVER,
        )

    def test_sound_while_hovering(self):
        # Noise must not trigger contact when the pen is raised.
        self.assertEqual(
            self.read(12, friction=True, moving=True),
            PenState.HOVER,
        )

    def test_near_surface_without_friction(self):
        self.assertEqual(
            self.read(1, moving=True),
            PenState.HOVER,
        )

    def test_writing_starts_contact(self):
        self.start_contact()

    def test_pause_preserves_contact(self):
        self.start_contact()
        self.assertEqual(self.read(1), PenState.CONTACT)

    def test_small_height_jitter_preserves_contact(self):
        self.start_contact()

        for height in [1.5, 2.5, 3, 2, 4.9]:
            with self.subTest(height=height):
                self.assertEqual(
                    self.read(height),
                    PenState.CONTACT,
                )

    def test_lifting_ends_contact_even_with_sound(self):
        self.start_contact()
        self.assertEqual(
            self.read(8, friction=True, moving=True),
            PenState.HOVER,
        )

    def test_tracking_loss_ends_contact(self):
        self.start_contact()
        self.assertEqual(
            self.read(None, tracking=False),
            PenState.LOST,
        )

    def test_recovery_requires_fresh_contact_evidence(self):
        self.start_contact()
        self.read(None, tracking=False)

        # Reappearing near the surface alone must not resume drawing.
        self.assertEqual(self.read(1), PenState.HOVER)

        # Fresh writing evidence can start contact again.
        self.assertEqual(
            self.read(1, friction=True, moving=True),
            PenState.CONTACT,
        )

    def test_invalid_heights_report_lost(self):
        for height in [None, -1, float("nan"), float("inf")]:
            with self.subTest(height=height):
                self.assertEqual(
                    self.read(height),
                    PenState.LOST,
                )


if __name__ == "__main__":
    unittest.main(verbosity=2)