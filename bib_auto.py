
#!/usr/bin/env python3
"""Automatically generate Wiki bibliography from BibTeX."""

from pathlib import Path
import re

from pybtex.database import parse_file
from pybtex.style.formatting.alpha import Style


ROOT = Path(__file__).resolve().parent

BIB_COMMAND = re.compile(
    r'\\bibliography\{([^{}]+)\}'
)

CITATION = re.compile(
    r'\\cite(?:\[[^\]]*\])?\{([^{}]+)\}'
)


def expand_bibliography(src):
    """Replace \\bibliography{...} with Wiki references."""

    commands = list(BIB_COMMAND.finditer(src))

    if not commands:
        return src

    if len(commands) != 1:
        raise ValueError(
            "Each Wiki note should contain at most "
            "one bibliography command."
        )

    if re.search(r'\\begin\{references\}', src):
        raise ValueError(
            "Do not combine \\bibliography with "
            "a manual references environment."
        )

    name = commands[0].group(1).strip()

    if not re.fullmatch(r'[\w-]+', name):
        raise ValueError(
            "Invalid bibliography filename: " + name
        )

    bib_file = ROOT / (name + ".bib")

    if not bib_file.is_file():
        raise FileNotFoundError(bib_file)

    # Collect citation keys, preserving first occurrence.
    keys = []

    for match in CITATION.finditer(src):
        for key in match.group(1).split(","):
            key = key.strip()

            if key and key not in keys:
                keys.append(key)

    bib_data = parse_file(str(bib_file))

    missing = [
        key for key in keys
        if key not in bib_data.entries
    ]

    if missing:
        raise ValueError(
            "Missing bibliography entries: " +
            ", ".join(missing)
        )

    # Alphabetic citation labels, e.g. [Yau75].
    style = Style()

    formatted = style.format_bibliography(
        bib_data,
        citations=keys
    )

    items = []

    for entry in formatted.entries:
        label = entry.label
        key = entry.key

        body = entry.text.render_as("text")

        items.append(
            "\\bibitem[" + label + "]{" +
            key + "}\n" +
            body + "\n"
        )

    references = (
        "\\begin{references}\n" +
        "\n".join(items) +
        "\\end{references}"
    )

    return BIB_COMMAND.sub(
        lambda match: references,
        src,
        count=1
    )
