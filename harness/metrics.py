# -*- coding: utf-8 -*-
"""指标汇总：从每个 task 的 run.json 汇总成表。
口径写死在这里，改口径就改这里，不需要手工填 Excel。"""
import json
import statistics
from pathlib import Path


def _pct(xs, q):
    if not xs:
        return 0.0
    xs = sorted(xs)
    k = (len(xs) - 1) * q
    lo, hi = int(k), min(int(k) + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def aggregate(root="artifacts"):
    root = Path(root)
    runs = []
    for p in sorted(root.glob("*/run.json")):
        try:
            runs.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            continue
    if not runs:
        return {"count": 0, "note": "还没有跑过任何任务"}
    durs = [r["duration_s"] for r in runs]
    rounds = [r["rounds"] for r in runs]
    calls = [r["agent_calls"] for r in runs]
    ok = [r for r in runs if r["status"] in ("passed", "degraded")]
    multi = [r for r in runs if r["rounds"] > 1]
    fixed = [r for r in multi if r["status"] == "passed"]
    return {
        "count": len(runs),
        "pass": len(ok),
        "pass_rate": round(len(ok) / len(runs), 4),
        "degraded": sum(1 for r in runs if r["status"] == "degraded"),
        "failed": sum(1 for r in runs if r["status"] == "failed"),
        "blocked": sum(1 for r in runs if r["status"] == "blocked"),
        "avg_rounds": round(statistics.fmean(rounds), 3),
        "multi_round_tasks": len(multi),
        "fixed_by_loop": len(fixed),
        "p50_s": round(_pct(durs, 0.5), 3),
        "p95_s": round(_pct(durs, 0.95), 3),
        "max_s": round(max(durs), 3),
        "agent_calls_total": sum(calls),
        "agent_calls_avg": round(statistics.fmean(calls), 2),
        "rows": runs,
    }
