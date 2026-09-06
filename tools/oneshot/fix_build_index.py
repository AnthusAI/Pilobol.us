import re
with open("web/build.py", "r") as f:
    py = f.read()

effects_block = """    (DIST / "effects").mkdir(exist_ok=True)
    
    # Build the effects index
    index_src = CONTENT / "effects" / "index.md"
    index_fragment = run_markus(index_src)
    (DIST / "effects" / "index.html").write_text(
        page("Generative Art Effects", index_fragment, active="", depth=1), encoding="utf-8"
    )

    for effect in ("physarum", "reaction-diffusion", "cellular-automata"):
        src = CONTENT / "effects" / f"{effect}.md"
        fragment = run_markus(src)
        title = {"physarum": "Effect: Physarum Polycephalum",
                  "reaction-diffusion": "Effect: Reaction-Diffusion",
                  "cellular-automata": "Effect: Continuous Cellular Automata"}[effect]
        (DIST / "effects" / f"{effect}.html").write_text(
            page(title, fragment, active="", depth=1), encoding="utf-8"
        )"""

# I need to replace the old effects_block with the new one
py = re.sub(r'    \(DIST / "effects"\)\.mkdir\(exist_ok=True\).*?encoding="utf-8"\n        \)', effects_block, py, flags=re.DOTALL)

with open("web/build.py", "w") as f:
    f.write(py)
