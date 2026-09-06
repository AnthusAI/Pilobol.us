import re
with open("web/build.py", "r") as f:
    py = f.read()

effects_block = """    (DIST / "effects").mkdir(exist_ok=True)
    for effect in ("physarum", "reaction-diffusion", "cellular-automata"):
        src = CONTENT / "effects" / f"{effect}.md"
        fragment = run_markus(src)
        title = {"physarum": "Effect: Physarum Polycephalum",
                  "reaction-diffusion": "Effect: Reaction-Diffusion",
                  "cellular-automata": "Effect: Continuous Cellular Automata"}[effect]
        (DIST / "effects" / f"{effect}.html").write_text(
            page(title, fragment, active="", depth=1), encoding="utf-8"
        )
"""
py = py.replace(
    '(DIST / "articles").mkdir(exist_ok=True)',
    '(DIST / "articles").mkdir(exist_ok=True)\n    (DIST / "effects").mkdir(exist_ok=True)'
)

py = py.replace(
    'print("Built:", DIST)',
    effects_block + '\n    print("Built:", DIST)'
)

with open("web/build.py", "w") as f:
    f.write(py)
