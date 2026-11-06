
from pathlib import Path
import os
import subprocess
import sys

from livereload import Server

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)

def build():
    env = os.environ.copy()
    env.pop("WIKI_BASE_PATH", None)

    result = subprocess.run(
        [sys.executable, "build.py"],
        cwd=ROOT,
        env=env,
        check=False
    )

    if result.returncode != 0:
        print("Build failed. Please check the error above.")

# Build the website when starting.
build()

# Watch changes and automatically rebuild.
server = Server()

server.watch("notes/*.wiki", build)
server.watch("build.py", build)
server.watch("template.html", build)
server.watch("assets/*.css", build)
server.watch("assets/*.js", build)

# Start the local website.
server.serve(
    root=str(ROOT / "_site"),
    host="127.0.0.1",
    port=8000
)
