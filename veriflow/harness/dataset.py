# -*- coding: utf-8 -*-
"""合成数据生成器：一份「干净数据」+ 若干「故意弄脏」的变体。
真实场景请替换成你的数据源；这里的脏数据只用于验证闭环是否真的生效。"""
import csv
import random
from pathlib import Path

COLS = ["sample_id", "group", "value", "unit"]


def make_clean(n=120, seed=7):
    rnd = random.Random(seed)
    rows = []
    for i in range(n):
        g = "A" if i % 2 == 0 else "B"
        base = 10.0 if g == "A" else 12.5          # 真实均值差 2.5
        v = rnd.gauss(base, 1.0)
        rows.append({"sample_id": f"S{i:03d}", "group": g,
                     "value": f"{v:.6f}", "unit": "mg"})
    return rows


def dirty(rows, fault):
    """返回被污染的行；fault 与 cases 中的 bug 字段一致。"""
    rows = [dict(r) for r in rows]
    if fault == "missing_group_col":
        for r in rows:
            r.pop("group", None)
    elif fault == "unit_mismatch":
        for r in rows:
            if r.get("group") == "B":
                r["value"] = f"{float(r['value']) * 1000.0:.6f}"   # mg -> ug 混用
                r["unit"] = "ug"
    elif fault == "null_ratio":
        for i, r in enumerate(rows):
            if i % 3 == 0:
                r["value"] = ""
    return rows


def write_csv(rows, path):
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)
    return str(p)
