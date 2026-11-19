# -*- coding: utf-8 -*-
"""验证器：五级判据。关键是 L3/L4 —— 由独立实现复算，而不是让模型自评。
L1 结构 | L2 可执行 | L3 基准数值比对 | L4 交叉独立复算 | L5 人工放行（此处留接口）
"""
import csv
import statistics

TOL_L3 = 1e-6      # 相对误差阈值
TOL_L4 = 1e-9


def _load_rows(csv_path):
    rows = []
    with open(csv_path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    return rows


def independent_recompute(csv_path):
    """与 executor 生成的脚本完全不同的实现路径：
    脚本用 sum/len + csv.DictReader；这里用 statistics.fmean + 先分组再过滤。
    两次独立复算的方法也不一样（fmean vs 纯手工），用于 L4 交叉核对。"""
    rows = _load_rows(csv_path)
    a, b = [], []
    for r in rows:
        g = (r.get("group") or "").strip()
        v = (r.get("value") or "").strip()
        if v == "":
            continue
        try:
            x = float(v)
        except ValueError:
            continue
        (a if g == "A" else b if g == "B" else []).append(x)
    n_a, n_b = len(a), len(b)
    mean_a = statistics.fmean(a) if a else float("nan")
    mean_b = statistics.fmean(b) if b else float("nan")
    diff = mean_b - mean_a
    # 手工路径（L4 用）：先排序再逐项累加，浮点累加顺序与上不同
    def manual(xs):
        s = 0.0
        for x in sorted(xs):
            s += x
        return s / len(xs) if xs else float("nan")
    diff_manual = (manual(b) if b else float("nan")) - (manual(a) if a else float("nan"))
    return {"n_a": n_a, "n_b": n_b, "mean_a": mean_a, "mean_b": mean_b,
            "diff": diff, "diff_manual": diff_manual}


def relative_error(x, y):
    if x is None or y is None:
        return float("inf")
    denom = max(abs(y), 1e-12)
    return abs(x - y) / denom


def verify(tid, store, exec_res, result, csv_path, rnd, truth_diff=2.5, tol=0.5):
    checks = []
    ref = independent_recompute(csv_path)
    from . import kb as _kb
    from . import tools as _tools
    hits = _kb.search("组间均值差 口径 缺失值 单位 容差", k=2)
    kb_ref = hits[0]["ref"] if hits else "无命中"
    store.log(tid, "kb", round=rnd, event="cite", refs=[h["ref"] for h in hits])

    # L2 先看有没有崩：崩了就不用谈数值
    l2_ok = exec_res["exit"] == 0
    checks.append({"level": "L2", "name": "可执行", "pass": l2_ok,
                   "detail": f"exit={exec_res['exit']}" +
                             (f" | {exec_res.get('stderr_last','')[:120]}" if not l2_ok else "")})

    # L1 结构
    l1_ok = bool(result) and all(k in result for k in ("diff", "n_a", "n_b")) \
        and result.get("n_a", 0) > 0 and result.get("n_b", 0) > 0
    checks.append({"level": "L1", "name": "结构完整", "pass": l1_ok,
                   "detail": f"keys={sorted(result) if result else None} "
                             f"n_a={result.get('n_a') if result else None} "
                             f"n_b={result.get('n_b') if result else None}"})

    # L3 与基准真值比对（对外口径是否正确：量纲、分组、指标定义）
    l3_ok, l3_detail = False, "无可比对结果"
    if l1_ok:
        cmp = _tools.call("compare_truth", value=result.get("diff"),
                          truth=truth_diff, tol=tol)
        err_abs = cmp["diff"]
        l3_ok = cmp["pass"]
        l3_detail = (f"platform={result.get('diff'):.6f} / 基准真值={truth_diff:.6f} "
                     f"/ |偏差|={err_abs:.6f} / 容差={tol:.2f} / 口径来源={kb_ref}")
        store.log(tid, "verify", round=rnd, event="tool_call", tool="compare_truth",
                  value=round(float(result.get("diff")), 6), truth=truth_diff,
                  diff=round(err_abs, 6), pass_=cmp["pass"])
    checks.append({"level": "L3", "name": "基准真值比对", "pass": l3_ok, "detail": l3_detail})

    # L4 交叉独立复算：平台结果 vs 验证器独立实现（不同代码路径）
    #    且验证器内部两条路径（fmean / 手工累加）必须自洽
    l4_detail, l4_ok = "无可比对结果", False
    if l1_ok:
        e1 = relative_error(result.get("diff"), ref["diff"])
        e2 = relative_error(ref["diff"], ref["diff_manual"])
        l4_ok = e1 <= TOL_L4 and e2 <= TOL_L4
        l4_detail = (f"platform={result.get('diff'):.6f} / independent={ref['diff']:.6f} "
                     f"/ rel_err={e1:.3e} ; 验证器内部两路径 rel_err={e2:.3e} "
                     f"/ tol={TOL_L4:.0e}")
    checks.append({"level": "L4", "name": "交叉独立复算", "pass": l4_ok, "detail": l4_detail})

    passed = l1_ok and l2_ok and l3_ok and l4_ok

    # 失败归类：给循环用的结构化结论，而不是一句"看起来不对"
    if not l2_ok:
        fail_type, evidence = "tool_fail", exec_res.get("stderr_last", "")[:200]
    elif not l1_ok:
        fail_type = "input_data" if (result is None or result.get("n_b", 0) == 0) else "structure"
        evidence = f"n_a={result.get('n_a') if result else None}, n_b={result.get('n_b') if result else None}"
    elif not l3_ok:
        fail_type, evidence = "logic", l3_detail
    else:
        fail_type, evidence = None, ""

    verdict = {"round": rnd, "passed": passed, "fail_type": fail_type,
               "evidence": evidence, "checks": checks}
    store.dump(tid, f"verify_r{rnd}.json", verdict)
    store.log(tid, "verify", round=rnd, passed=passed, fail_type=fail_type,
              failed_levels=[c["level"] for c in checks if not c["pass"]])
    return verdict
