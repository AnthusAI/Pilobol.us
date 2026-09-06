import re

with open("web/build.py", "r") as f:
    code = f.read()

code = re.sub(
    r"def run_markus\(src: Path\) -> str:.*?return out\.replace.*?>\"\)",
    """def run_markus(src: Path) -> str:
    result = subprocess.run(
        ["markus", "convert", str(src), "--fragment", "--no-css"],
        capture_output=True,
        text=True,
        check=True,
    )
    out = result.stdout.replace("&lt;", "<").replace("&gt;", ">")
    return out""",
    code,
    flags=re.DOTALL
)

with open("web/build.py", "w") as f:
    f.write(code)
