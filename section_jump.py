
#!/usr/bin/env python3

"""
Add local-only Edit links to headings
and theorem-like blocks.

Run AFTER build.py.

Only modifies _site/ HTML.
Never modifies .wiki files or build.py.
"""

from pathlib import Path
from urllib.parse import quote
import html
import re


ROOT = Path(__file__).resolve().parent
NOTES = ROOT / "notes"
OUTPUT = ROOT / "_site" / "notes"


# ==========================================
# 1. HTML matching patterns
# ==========================================

HEADING = re.compile(
    r"<h([123])(?=[\s>])([^>]*)>(.*?)</h\1>",
    re.S | re.I
)

ARTICLE = re.compile(
    r"(<article(?:\s[^>]*)?>)(.*?)(</article>)",
    re.S | re.I
)

THEOREM_OPEN = re.compile(
    r'(<div\b(?=[^>]*\bclass\s*=\s*["\'][^"\']*\btheorem\b)'
    r'[^>]*>\s*<header\b[^>]*>.*?</header>)',
    re.S | re.I
)


STANDARD_ENVS = {
    "definition",
    "theorem",
    "lemma",
    "proposition",
    "corollary",
    "remark",
    "example",
    "exercise",
    "proof",
}


SOURCE_BEGIN = re.compile(
    r"^\s*\\begin\{([A-Za-z]+)\}(?:\[[^\]]*\])?"
)

SOURCE_HEADING = re.compile(
    r"^\s*\\(section|subsection|subsubsection)\*?\{"
)

CUSTOM_ENV = re.compile(
    r"^\s*\\newtheorem\{([A-Za-z]+)\}"
)


# ==========================================
# 2. CSS for Edit links
# ==========================================

STYLE = """<style id="wiki-section-jump-css">

/* Chapter Edit links */

article .wiki-heading-with-edit {
    position: relative;
}

article .wiki-heading-with-edit > .wiki-source-jump {
    position: absolute;
    top: 50%;
    right: 0;
    transform: translateY(-50%);

    font: normal 0.76rem/1.4 system-ui, sans-serif;
    color: inherit;
    opacity: 0.55;
    text-decoration: none;
    white-space: nowrap;
}

/* Theorem Edit links */

article .theorem {
    position: relative;
}

article .theorem > .wiki-source-jump {
    position: absolute;
    top: 0.4rem;
    right: 0.65rem;

    font: normal 0.73rem/1.4 system-ui, sans-serif;
    color: inherit;
    opacity: 0.50;
    text-decoration: none;
    white-space: nowrap;
}

/* Hover and keyboard focus */

article .wiki-heading-with-edit >
.wiki-source-jump:hover,

article .wiki-heading-with-edit >
.wiki-source-jump:focus-visible,

article .theorem >
.wiki-source-jump:hover,

article .theorem >
.wiki-source-jump:focus-visible {
    opacity: 1;
    text-decoration: underline;
}

/* Small screens */

@media (max-width: 700px) {
    article .wiki-heading-with-edit >
    .wiki-source-jump {
        position: static;
        display: block;
        text-align: right;
        transform: none;
        margin-top: -0.4em;
    }
}

</style>"""


# ==========================================
# 3. Find source lines
# ==========================================

def source_locations(text):
    headings = []
    environments = []

    custom = set(CUSTOM_ENV.findall(text))
    valid = STANDARD_ENVS | custom

    for line_no, line in enumerate(
        text.splitlines(), 1
    ):
        match = SOURCE_HEADING.match(line)

        if match:
            levels = {
                "section": 1,
                "subsection": 2,
                "subsubsection": 3,
            }

            headings.append(
                (levels[match.group(1)], line_no)
            )

        match = SOURCE_BEGIN.match(line)

        if match and match.group(1) in valid:
            environments.append(
                (match.group(1), line_no)
            )

    return headings, environments


# ==========================================
# 4. Create a VS Code source link
# ==========================================

def source_link(file, line, category):
    url = (
        "vscode://file" +
        quote(str(file.resolve()), safe="/") +
        f":{line}:1"
    )

    return (
        '<a class="wiki-source-jump" href="' +
        html.escape(url, quote=True) +
        '" title="Edit ' +
        html.escape(category, quote=True) +
        ' at source line ' +
        str(line) +
        '" aria-label="Edit ' +
        html.escape(category, quote=True) +
        ' in VS Code">Edit</a>'
    )


# ==========================================
# 5. Annotate generated HTML
# ==========================================

def annotate(
    document,
    source_file,
    headings,
    environments
):
    article = ARTICLE.search(document)

    if not article:
        return document, 0, 0

    # -------------------------------
    # Section / Subsection links
    # -------------------------------

    h_index = 0
    h_added = 0

    def heading_link(m):
        nonlocal h_index, h_added

        level = int(m.group(1))

        if h_index >= len(headings):
            return m.group(0)

        expected_level, line = headings[h_index]

        if expected_level != level:
            return m.group(0)

        h_index += 1
        h_added += 1

        return (
            '<div class="wiki-heading-with-edit">' +
            m.group(0) +
            source_link(
                source_file, line, "section"
            ) +
            '</div>'
        )

    body = HEADING.sub(
        heading_link,
        article.group(2)
    )

    # -------------------------------
    # Theorem environment links
    # -------------------------------

    e_index = 0
    e_added = 0

    def env_link(m):
        nonlocal e_index, e_added

        if e_index >= len(environments):
            return m.group(0)

        kind, line = environments[e_index]

        e_index += 1
        e_added += 1

        # Edit is outside the theorem header,
        # so it does not affect its title.

        return (
            m.group(0) +
            source_link(
                source_file, line, kind
            )
        )

    body = THEOREM_OPEN.sub(
        env_link,
        body
    )

    result = (
        document[:article.start(2)] +
        body +
        document[article.end(2):]
    )

    # Inject CSS only once.
    if (
        (h_added or e_added) and
        "wiki-section-jump-css" not in result
    ):
        result = re.sub(
            r"</head\s*>",
            lambda m: (
                STYLE + "\n" + m.group(0)
            ),
            result,
            count=1,
            flags=re.I
        )

    return result, h_added, e_added


# ==========================================
# 6. Process all Wiki pages
# ==========================================

def main():
    total_h = 0
    total_e = 0

    for source in sorted(
        NOTES.glob("*.wiki")
    ):
        output = (
            OUTPUT /
            source.stem /
            "index.html"
        )

        if not output.is_file():
            continue

        original = output.read_text(
            encoding="utf-8"
        )

        headings, environments = source_locations(
            source.read_text(
                encoding="utf-8"
            )
        )

        result, h, e = annotate(
            original,
            source,
            headings,
            environments
        )

        if result != original:
            output.write_text(
                result,
                encoding="utf-8"
            )

        total_h += h
        total_e += e

    print(
        f"Added {total_h} section and "
        f"{total_e} theorem/proof Edit links "
        f"(local preview only)."
    )


if __name__ == "__main__":
    main()
