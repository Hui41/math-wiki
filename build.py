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
    src=re.sub(r'\\begin\{structure\}(.*?)\\end\{structure\}',structure,src,flags=re.S)
    def wikilink(m):
        slug=m.group(1).strip(); label=(m.group(2) or slug).strip()
        page=LOOKUP.get(slug)
        return '<a href="'+html.escape(href(page['slug']) if page else '#',quote=True)+'"'+('' if page else ' class="missing"')+'>'+html.escape(label)+'</a>'
    src=re.sub(r'\[\[([^\]|]+)(?:\|([^\]]+))?\]\]',wikilink,src)
    # IMPORTANT: protect TeX from Markdown rewriting underscores, backslashes, and asterisks.
    tokens={}
    def save(t):
        key='MATHTOKEN'+str(len(tokens))+'PLACEHOLDER'
        tokens[key]=t
        return key
    # First protect full display delimiters; their contents can include nested aligned/gathered.
    src=re.sub(r'\$\$(.*?)\$\$',lambda m:'\n\n'+save('\\['+m.group(1)+'\\]')+'\n\n',src,flags=re.S)
    src=re.sub(r'\\\[(.*?)\\\]',lambda m:'\n\n'+save('\\['+m.group(1)+'\\]')+'\n\n',src,flags=re.S)
    # MathJax 3 scans top-level AMS equation/align environments directly and handles labels.
    # Do not nest equation inside \[...\], which can lead to an erroneous nesting error.
    mathenvs=r'equation\*?|align\*?|gather\*?|multline\*?|eqnarray\*?'
    src=re.sub(r'\\begin\{('+mathenvs+r')\}.*?\\end\{\1\}',lambda m:'\n\n'+save(m.group(0))+'\n\n',src,flags=re.S)
    src=re.sub(r'(?<!\\)\$(?!\$)(.+?)(?<!\\)\$(?!\$)',lambda m:save('\\('+m.group(1)+'\\)'),src,flags=re.S)
    src=re.sub(r'\\\((.*?)\\\)',lambda m:save('\\('+m.group(1)+'\\)'),src,flags=re.S)
    names_en = {'definition':'Definition','theorem':'Theorem','lemma':'Lemma','proposition':'Proposition','corollary':'Corollary','remark':'Remark','example':'Example','exercise':'Exercise','proof':'Proof'}
    names_zh = {'definition':'定义','theorem':'定理','lemma':'引理','proposition':'命题','corollary':'推论','remark':'注','example':'例','exercise':'练习','proof':'证明'}
    names = names_en if lang == 'en' else names_zh
    names = {**names, **custom_names}
    # Ordinary prose and theorem headings are HTML-escaped; formulas were tokenized above.
    for name,label in names.items():
        pattern=re.compile(r'\\begin\{'+re.escape(name)+r'\}(?:\[([^\]]*)\])?(.*?)\\end\{'+re.escape(name)+r'\}',re.S)
        def block(m):
            title=label+((' ('+m.group(1)+')') if lang == 'en' else ('（'+m.group(1)+'）') if m.group(1) else '') if m.group(1) else label
            cls = name if name in names_en else 'definition'
            return '\n\n<div class="theorem '+cls+'">\n<header>'+html.escape(title)+'</header>\n<section>\n'+m.group(2).strip()+'\n</section>\n</div>\n\n'
        src=pattern.sub(block,src)
    # Bibliography: simple local references with clickable citation labels.
    citation_labels = {}
    def refs(m):
        items=re.split(r'\\bibitem(?:\[([^\]]*)\])?\{([^{}]+)\}',m.group(1))
        out=[]
        for i in range(1,len(items),3):
            display,key,body=items[i:i+3]
            citation_labels[key] = display or key
            body=re.sub(r'\{\\em\s+([^{}]+)\}',lambda x:'<em>'+html.escape(x.group(1))+'</em>',body)
            out.append('<li id="ref-'+html.escape(key,quote=True)+'">['+html.escape(display or key)+'] '+body.strip()+'</li>')
        return '\n\n<ol class="references">'+''.join(out)+'</ol>\n\n'
    src=re.sub(r'\\begin\{references\}(.*?)\\end\{references\}',refs,src,flags=re.S)
    def citation(m):
        links=[]
        for key in m.group(1).split(','):
            key=key.strip()
            label=citation_labels.get(key, key)
            links.append('<a href="#ref-'+html.escape(key,quote=True)+'">'+html.escape(label)+'</a>')
        return '['+', '.join(links)+']'
    src=re.sub(r'\\cite\{([^{}]+)\}',citation,src)
    src=re.sub(r'\\(?:emph|textit)\{([^{}]*)\}',lambda m:'*'+m.group(1)+'*',src)
    src=re.sub(r'\\textbf\{([^{}]*)\}',lambda m:'**'+m.group(1)+'**',src)
    src=re.sub(r'^\s*\\begin\{enumerate\}\s*$', '',src,flags=re.M)
    src=re.sub(r'^\s*\\end\{enumerate\}\s*$', '',src,flags=re.M)
    src=re.sub(r'^\s*\\item\s+', '1. ',src,flags=re.M)
    # markdown-it treats HTML blocks verbatim; render body of theorem sections independently.
    src=re.sub(r'(<section>\n)(.*?)(\n</section>)',lambda m:m.group(1)+MD.render(m.group(2))+m.group(3),src,flags=re.S)
    rendered=MD.render(src)
    for key,tex in tokens.items():rendered=rendered.replace(key,html.escape(tex,quote=False))
    return rendered,macros

TEMPLATE=(ROOT/'template.html').read_text(encoding='utf-8')
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir(); shutil.copytree(ROOT/'assets',OUT/'assets')
if BASE:
    js=OUT/'assets'/'wiki.js'
    js.write_text(js.read_text(encoding='utf-8').replace("'/search.json'", "'"+BASE+"/search.json'").replace("'/notes/'", "'"+BASE+"/notes/'"), encoding='utf-8')
metadata=[dict(title=p['title'],slug=p['slug'],text=re.sub(r'\\[a-zA-Z]+',' ',p['src'])[:6000]) for p in PAGES]
(OUT/'search.json').write_text(json.dumps(metadata,ensure_ascii=False),encoding='utf-8')
for p in PAGES:
    content,macros=compile_page(p)
    destination=OUT/'notes'/p['slug']; destination.mkdir(parents=True)
    doc=TEMPLATE.replace('/assets/',BASE+'/assets/').replace('/notes/',BASE+'/notes/').replace('<!-- TITLE -->',html.escape(p['title'])).replace('<!-- CONTENT -->',content).replace('<!-- NAV -->','<a href="'+BASE+'/notes/">All notes</a>')
    doc=doc.replace('/* PAGE_MACROS */',json.dumps(macros,ensure_ascii=False)[1:-1])
    (destination/'index.html').write_text(doc,encoding='utf-8')
links=''.join('<li><a href="'+href(p['slug'])+'">'+html.escape(p['title'])+'</a></li>' for p in PAGES)
index=TEMPLATE.replace('/assets/',BASE+'/assets/').replace('/notes/',BASE+'/notes/').replace('<!-- TITLE -->','Mathematical Notes').replace('<!-- CONTENT -->','<p>Mathematical notes index</p><ul class="index-list">'+links+'</ul>').replace('<!-- NAV -->','').replace('/* PAGE_MACROS */','')
(OUT/'notes').mkdir(exist_ok=True)
(OUT/'notes'/'index.html').write_text(index,encoding='utf-8')
(OUT/'.nojekyll').write_text('',encoding='utf-8')
print('Built',len(PAGES),'pages')
