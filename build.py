#!/usr/bin/env python3
"""Small LaTeX-friendly wiki renderer (not a full TeX engine)."""
from pathlib import Path
from urllib.parse import quote
import html, json, re, shutil, os
from markdown_it import MarkdownIt

ROOT=Path(__file__).resolve().parent
BASE='/' + os.environ.get('WIKI_BASE_PATH', '').strip('/') if os.environ.get('WIKI_BASE_PATH', '').strip('/') else ''
OUT=ROOT/'_site'
MD=MarkdownIt('commonmark', {'html': True, 'linkify': True})
NOTES=ROOT/'notes'
files=sorted(NOTES.glob('*.wiki'))
if not files: raise SystemExit('No .wiki notes in notes/')
PAGES=[]
for file in files:
    body=file.read_text(encoding='utf-8')
    m=re.search(r'^\\title\{([^\n]*)\}',body,re.M)
    PAGES.append(dict(slug=file.stem,title=m.group(1) if m else file.stem,src=body))
LOOKUP={p['slug']:p for p in PAGES}

def href(slug):
    return BASE+'/notes/'+quote(slug,safe='')+'/'

def balanced(s, i):
    """Read a braced group, honoring nested braces."""
    if i >= len(s) or s[i] != '{':
        return None
    depth = 0
    for j in range(i, len(s)):
        if s[j] == '{': depth += 1
        elif s[j] == '}':
            depth -= 1
            if depth == 0: return s[i+1:j], j+1
    return None


def macros_from(src):
    """Convert simple TeX declarations to MathJax macros (0-9 arguments)."""
    macros = {}
    chunks = []
    for line in src.splitlines():
        z = re.match(r'^\s*\\DeclareMathOperator(\*?)\s*\{\\([A-Za-z]+)\}\s*', line)
        if z:
            value = balanced(line, z.end())
            if value and not line[value[1]:].strip():
                op = r'\operatorname' + ('*' if z.group(1) else '') + '{' + value[0] + '}'
                macros[z.group(2)] = op
                continue
        z = re.match(r'^\s*\\(newcommand|renewcommand|providecommand)\s*\{\\([A-Za-z]+)\}\s*(?:\[([0-9])\])?\s*', line)
        if z:
            value = balanced(line, z.end())
            if value and not line[value[1]:].strip():
                n = int(z.group(3) or 0)
                macros[z.group(2)] = [value[0], n] if n else value[0]
                continue
        z = re.match(r'^\s*\\def\\([A-Za-z]+)((?:#\d)*)\s*', line)
        if z:
            value = balanced(line, z.end())
            if value and not line[value[1]:].strip():
                v = value[0]
                outer = balanced(v, 0)
                if outer and outer[1] == len(v): v = outer[0]
                n = len(re.findall(r'#\d', z.group(2)))
                macros[z.group(1)] = [v, n] if n else v
                continue
        chunks.append(line)
    return '\n'.join(chunks), macros

def compile_page(p):
    src=p['src']
    src,macros=macros_from(src)
    src=re.sub(r'^\\title\{[^\n]*\}\s*$', '',src,flags=re.M)
    src=re.sub(r'^\\theoremstyle\{[^\n]*\}\s*$', '',src,flags=re.M)
    custom_names = dict(re.findall(r'^\\newtheorem\{([a-zA-Z]+)\}(?:\[[^\]]+\])?\{([^\n{}]+)\}\s*$', src, flags=re.M))
    src = re.sub(r'^\\newtheorem\{[a-zA-Z]+\}(?:\[[^\]]+\])?\{[^\n{}]+\}\s*$', '', src, flags=re.M)
    lang_marker = re.search(r'^\\wikilang\{(en|zh)\}\s*$', src, re.M)
    if lang_marker:
        lang = lang_marker.group(1)
    else:
        lang = 'zh' if re.search(r'[\u4e00-\u9fff]', re.sub(r'\\(?:title|newtheorem)\{[^\n]*', '', src)) else 'en'
    src = re.sub(r'^\\wikilang\{(?:en|zh)\}\s*$', '', src, flags=re.M)
    for cmd,mark in [('section','#'),('subsection','##'),('subsubsection','###')]:
        src=re.sub(r'^\\'+cmd+r'\*?\{([^\n{}]+)\}\s*$',lambda m:mark+' '+m.group(1),src,flags=re.M)
    # Wiki's hierarchical navigation is not LaTeX math. Render a local page tree.
    def structure(m):
        rows=[]
        for raw in m.group(1).splitlines():
            x=re.match(r'^\s*\\(subpage|subsubpage)\{([^{}]+)\}',raw)
            if not x:continue
            label=x.group(2).strip(); slug=label
            found=LOOKUP.get(slug)
            h=href(found['slug']) if found else '#'
            cls='' if found else ' class="missing" title="Create a page with this filename"'
            rows.append(f'<li class="{x.group(1)}"><a href="{html.escape(h,quote=True)}"{cls}>{html.escape(label)}</a></li>')
        return '\n\n<nav class="structure"><strong>目录</strong><ul>'+''.join(rows)+'</ul></nav>\n\n'
