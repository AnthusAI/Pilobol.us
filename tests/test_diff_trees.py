import importlib.util
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "bin" / "diff-trees.py"
spec = importlib.util.spec_from_file_location("diff_trees", SCRIPT)
diff_trees = importlib.util.module_from_spec(spec)
spec.loader.exec_module(diff_trees)


def write_tree(root, files):
    for name, data in files.items():
        path = Path(root) / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)


class DiffTreesTest(unittest.TestCase):
    def test_identical_trees_exit_zero(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            write_tree(a, {"x/index.html": b"same"})
            write_tree(b, {"x/index.html": b"same"})
            self.assertEqual(diff_trees.main([a, b]), 0)

    def test_reports_only_in_either_and_differing(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            write_tree(a, {"a.html": b"one", "gone.txt": b"x", "d.html": b"abc"})
            write_tree(b, {"a.html": b"one", "new.txt": b"y", "d.html": b"abd"})
            self.assertEqual(
                diff_trees.diff_trees(a, b),
                (["gone.txt"], ["new.txt"], ["d.html"]),
            )
            self.assertEqual(diff_trees.main([a, b]), 1)

    def test_live_comparison_names_flipped_file(self):
        with tempfile.TemporaryDirectory() as dist:
            write_tree(dist, {"a.html": b"one", "b.html": b"two"})
            live = {"a.html": b"one", "b.html": b"twp"}
            names, missing, differing = diff_trees.diff_live(
                dist, "https://example.test", lambda base, name: live.get(name)
            )
            self.assertEqual((len(names), missing, differing), (2, [], ["b.html"]))


if __name__ == "__main__":
    unittest.main()
