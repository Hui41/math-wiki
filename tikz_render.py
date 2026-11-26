"""Compile Wiki diagrams to standalone, content-addressed SVG files."""
import hashlib
import html
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

_BLOCK = (
    r"\\begin\{(?P<kind>tikzpicture|tikzcd)\}"
    r".*?\\end\{(?P=kind)\}"
)
_DIAGRAM = re.compile(
    r"(?m)^(?P<fence>[ \t]{0,3}(?:`{3,}|~{3,}))[^\n]*\n"
    r".*?^[ \t]{0,3}(?P=fence)[`~]*[ \t]*$"
    r"|^[ \t]*(?P<display>\$\$\s*|\\\[\s*)?" + _BLOCK +
    r"[ \t]*(?(display)\s*(?:\$\$|\\\]))[ \t]*(?=\n|$)",
    re.S,
)
_PREAMBLE = re.compile(
    r"(?m)^[ \t]*(?P<command>\\(?:usetikzlibrary|usetikzcdlibrary|tikzset))"
    r"(?=[ \t]*\{)"
)
_PACKAGE = re.compile(r"(?m)^[ \t]*\\usepackage\{(?:tikz|tikz-cd)(?:\s*,\s*(?:tikz|tikz-cd))*\}[ \t]*$")
_HEADER = r"""\documentclass{article}
% Emit graphics specials understood by dvisvgm in DVI mode.
\def\pgfsysdriver{pgfsys-dvisvgm.def}
\usepackage{amsmath,amssymb,tikz,tikz-cd}
\usetikzlibrary{arrows.meta,calc,positioning}
\pagestyle{empty}
"""


def _tool(name):
    for directory in (None, "/Library/TeX/texbin"):
        executable = shutil.which(name, path=directory)
        if executable:
            return executable
    raise RuntimeError(f"TikZ requires {name}; install MacTeX or TeX Live")


def _run(command, directory):
    result = subprocess.run(
        command, cwd=directory, stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, errors="replace", timeout=45,
        env={**os.environ, "openin_any": "p", "openout_any": "p"},
    )
    if result.returncode:
        raise RuntimeError(result.stdout[-5000:].strip())


def _compile(document, cache):
    digest = hashlib.sha256(document.encode("utf-8")).hexdigest()
    destination = cache / f"{digest}.svg"
    if destination.is_file():
        return destination

    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=cache) as directory:
        work = Path(directory)
        (work / "diagram.tex").write_text(document, encoding="utf-8")
        _run([_tool("latex"), "-no-shell-escape", "-halt-on-error",
              "-interaction=nonstopmode", "-file-line-error", "diagram.tex"], work)
        _run([_tool("dvisvgm"), "--no-fonts", "--bbox=min",
              "--output=diagram.svg", "diagram.dvi"], work)
        (work / "diagram.svg").replace(destination)
    return destination


def render_tikz(source, note, cache, base, macros_from):
    """Return Wiki text with HTML image blocks and the SVGs it references."""
    matches = list(_DIAGRAM.finditer(source))
    diagrams = [match for match in matches if match["kind"]]
    if not diagrams:
        return source, set()

    # Collect TikZ directives from prose outside diagrams and fenced examples.
    protected = [(match.start(), match.end()) for match in matches]
    directives = []
    removals = []
    for match in _PREAMBLE.finditer(source):
        if any(start <= match.start() < end for start, end in protected):
            continue
        start = source.index("{", match.end())
        depth = 0
        for brace in re.finditer(r"(?<!\\)[{}]|(?<!\\)%[^\n]*", source[start:]):
            if brace[0].startswith("%"):
                continue
            depth += 1 if brace[0] == "{" else -1
            if depth == 0:
                end = start + brace.end()
                directives.append(source[match.start():end])
                removals.append((match.start(), end, ""))
                break

    prose = list(source)
    for start, end in protected:
        prose[start:end] = ["\n" if char == "\n" else " " for char in source[start:end]]
    for match in _PACKAGE.finditer("".join(prose)):
        removals.append((match.start(), match.end(), ""))
    macros = macros_from("".join(prose))
    definitions = []
    for name, value in macros.items():
        body, count = value if isinstance(value, list) else (value, 0)
        parameters = "".join(f"#{number}" for number in range(1, count + 1))
        definitions.append(r"\def" + chr(92) + name + parameters + "{" + body + "}")

    files = set()
    for match in diagrams:
        line = source.count("\n", 0, match.start()) + 1
        block = match[0].strip()
        start = block.index(r"\begin{")
        end = block.rindex("}") + 1
        document = "\n".join([
            _HEADER, *definitions, *directives, r"\begin{document}",
            block[start:end], r"\end{document}", "",
        ])
        try:
            svg = _compile(document, cache)
        except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
            raise RuntimeError(f"{note}:{line}: {match['kind']} failed\n{error}") from error
        files.add(svg)
        url = html.escape(f"{base}/assets/tikz/{svg.name}", quote=True)
        alt = "Commutative diagram" if match["kind"] == "tikzcd" else "TikZ diagram"
        removals.append((match.start(), match.end(),
                         f'\n\n<div class="wiki-tikz"><img src="{url}" alt="{alt}"></div>\n\n'))

    for start, end, replacement in sorted(removals, reverse=True):
        source = source[:start] + replacement + source[end:]
    return source, files
