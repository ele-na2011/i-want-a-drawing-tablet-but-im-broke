import ast
import unittest
from pathlib import Path


class FaceTrackingScriptTests(unittest.TestCase):
    def test_face_tracking_has_main_entrypoint(self):
        source_path = Path(__file__).resolve().parents[1] / "src" / "face_tracking.py"
        tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=str(source_path))

        function_names = {
            node.name for node in ast.walk(tree)
            if isinstance(node, ast.FunctionDef)
        }

        self.assertIn("main", function_names)


if __name__ == "__main__":
    unittest.main()
