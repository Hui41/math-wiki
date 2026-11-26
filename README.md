# Personal Math Wiki — BananaSpace-style starter (v2)

An independent, **static** math wiki with a TeX-like writing syntax. It is not a complete clone of BananaSpace or a full LaTeX compiler.

## Demo pages

- `notes/调和映射.wiki`: navigation using `structure/subpage/subsubpage`.
- `notes/基本概念.wiki`: sample Chinese mathematical notes with theorem/proof/exercise, local macros, equation labels and references.
- `notes/PseuHerm.wiki` and `notes/Sas.wiki`: original starter examples.

All content and code can be maintained independently. Pages appear at `/notes/<filename>/` (Chinese file names become URL-encoded in the address bar).

## Supported writing syntax

- `\title{标题}` and `\section{}`, `\subsection{}`, `\subsubsection{}`
- `\begin{structure} ... \subpage{基本概念} ... \subsubpage{梯度估计} ... \end{structure}`; an existing `notes/基本概念.wiki` becomes a link. Missing pages have a dashed/muted link.
- `$...$`, `$$...$$`, `\[...\]`, `\begin{equation}`, `\begin{align}`, and standard MathJax TeX environments
- Theorem blocks `definition`, `theorem`, `lemma`, `proposition`, `corollary`, `remark`, `exercise`, `example`, `proof`, including optional titles.
- Parameterless `\def\rr{{\mathbb R}}` and `\newcommand{\la}{\langle}` at beginning or on individual lines (per page only).
- `\newtheorem{exercise}[theorem]{练习}` is accepted (label handled by built-in exercise support, but number sharing isn't implemented).
- `[[Sas]]`, `[[基本概念|开始阅读]]` for links.
- Basic `\begin{references}`, `\bibitem[label]{key}`, and `\cite{key}` supported. No full BibTeX processor.
- MathJax does equation labels `\label{...}` and `\eqref{...}` in the browser. Requires MathJax CDN access.

## Not yet supported

Full TeX macro expansion (especially macros with arguments), automatic theorem numbering across pages, complete bibliography tooling, arbitrary LaTeX packages, nested custom environments, and direct edit-on-wiki-site. The parser will need more work for such cases; check complex formula display in a browser.

## Build locally

```sh
python -m pip install markdown-it-py==3.0.0
python build.py
python -m http.server 8000 --directory _site
```

Open `http://localhost:8000/notes/`. Run the server rather than opening `index.html` as a `file://` URL.


## Local preview

Run `python build.py` with no `WIKI_BASE_PATH` to keep links rooted at `/` for `http://localhost:8000/notes/`. The GitHub workflow applies the prefix only during deployment.


### TikZ 图形

在 `.wiki` 中单独成段写 `tikzpicture` 或 `tikzcd`，例如：

```latex
\begin{tikzcd}
A \arrow[r,"f"] & B
\end{tikzcd}
```

Mac 使用 MacTeX 的 `latex` 和 `dvisvgm`。打开 **Math Wiki: Open Preview** 后保存笔记即可刷新。可在笔记中用 `\usetikzlibrary`、`\usetikzcdlibrary` 或 `\tikzset` 加载库及定义样式。图中的文字由 TeX 编译，页面里的 MathJax 公式编号不会传给图形。

构建将编译好的 SVG 缓存在 `.tikz-cache/`，并把当前页面引用的图复制到 `_site/assets/tikz/`。编译失败时，错误会标出对应的笔记和行号。
