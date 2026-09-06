import re
with open("web/build.py", "r") as f:
    code = f.read()
code = code.replace(
    'out = result.stdout.replace("&lt;", "<").replace("&gt;", ">")',
    'out = result.stdout.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\\"")'
)
with open("web/build.py", "w") as f:
    f.write(code)
