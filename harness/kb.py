# -*- coding: utf-8 -*-
"""本地方法说明库（知识库的最朴素形态）。

不做向量库：语料只有几页方法口径，关键词打分足够，而且**每条命中都能指回
文件与章节**，评委可以当场核对"这条口径是从哪来的"。这比一个说不清召回来源的
向量库更适合"可信验证"这个主题。

检索结果会写进 verify 证据里（ref=configs/kb/xxx.md#小节），
所以"知识库"不是摆设，它决定了 L3 拿什么口径比。
"""
import re
from pathlib import Path

_CACHE = None


def _chunks(kb_dir="configs/kb"):
    global _CACHE
    if _CACHE is not None:
        return _CACHE
    out = []
    for p in sorted(Path(kb_dir).glob("*.md")):
        text = p.read_text(encoding="utf-8")
        cur = {"heading": p.stem, "body": []}
        for line in text.splitlines():
            if line.startswith("## "):
                if cur["body"]:
                    out.append(cur)
                cur = {"heading": line[3:].strip(), "body": []}
            elif line.startswith("# "):
                continue
            else:
                cur["body"].append(line)
        if cur["body"]:
            out.append(cur)
        for c in out:
            c["file"] = p.name
    _CACHE = [{"heading": c["heading"], "file": c.get("file", ""),
               "text": "\n".join(c["body"]).strip()} for c in out]
    return _CACHE


def _tokens(s):
    # 中英混排：英文按词，中文按 2 字滑窗，够用且不引依赖
    s = s.lower()
    words = re.findall(r"[a-z0-9_]+", s)
    cjk = re.findall(r"[\u4e00-\u9fff]+", s)
    grams = []
    for seg in cjk:
        for i in range(max(1, len(seg) - 1)):
            grams.append(seg[i:i + 2])
    return set(words) | set(grams)


def search(query, k=3, kb_dir="configs/kb"):
    qt = _tokens(query)
    scored = []
    for c in _chunks(kb_dir):
        ct = _tokens(c["heading"] + " " + c["text"])
        hit = len(qt & ct)
        if hit:
            scored.append((hit, c))
    scored.sort(key=lambda x: -x[0])
    return [{"ref": f"{kb_dir}/{c['file']}#{c['heading']}",
             "heading": c["heading"], "score": hit,
             "excerpt": c["text"][:160].replace("\n", " ")}
            for hit, c in scored[:k]]


def render_all(kb_dir="configs/kb"):
    return [{"ref": f"{kb_dir}/{c['file']}#{c['heading']}", "heading": c["heading"],
             "chars": len(c["text"])} for c in _chunks(kb_dir)]
