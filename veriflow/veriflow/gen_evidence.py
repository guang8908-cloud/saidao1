# -*- coding: utf-8 -*-
"""把骨架跑出来的真实日志汇总成一份可粘进方案书/PPT 的证据摘录。
数字全部从 artifacts/ 读取，不手填。"""
import json
from pathlib import Path

A = Path("artifacts")
table = json.loads((A / "suite_table.json").read_text(encoding="utf-8"))


def rd(p):
    f = A / p
    return [json.loads(x) for x in f.read_text(encoding="utf-8").splitlines() if x.strip()] \
        if f.exists() else []


cases = table["full"]
L = []
L.append("# 骨架实测日志摘录（自动生成，数字未手填）\n")
L.append("运行命令：`python -m harness suite`　生成时间戳见各 `artifacts/<用例>/ *.log`\n")
L.append("## 一、三档基线对比\n")
L.append("| 用例 | 场景 | single | chain | full | full 轮次 |")
L.append("|---|---|---|---|---|---|")
for c in cases:
    rid = c["id"]
    s = table["single"][[x["id"] for x in table["single"]].index(rid)]
    ch = table["chain"][[x["id"] for x in table["chain"]].index(rid)]
    L.append(f"| {rid} | {c['name']} | {s['status']} | {ch['status']} | {c['status']} | {c['rounds']} |")

def cnt(mode):
    rows = table[mode]
    ok = sum(1 for x in rows if x["status"] in ("passed", "degraded"))
    dur = sorted(x["duration_s"] for x in rows)
    return ok, len(rows), sum(x["rounds"] for x in rows) / len(rows), dur[min(len(dur) - 1, int(0.95 * (len(dur) - 1)))]

L.append("\n| 档位 | 通过 | 平均轮次 | P95 端到端 |")
L.append("|---|---|---|---|")
for m in ("single", "chain", "full"):
    ok, n, ar, p95 = cnt(m)
    L.append(f"| {m} | {ok}/{n} | {ar:.2f} | {p95:.2f}s |")

L.append("\n## 二、自循环真实过程（T-05：量纲混用）\n")
L.append("第一轮被 L3 拦下（证据是数字，不是「感觉不对」）：\n")
v1 = json.loads((A / "T-05" / "verify_r1.json").read_text(encoding="utf-8"))
for c in v1["checks"]:
    L.append(f"- {c['level']} {c['name']}：{'通过' if c['pass'] else '未通过'} — {c['detail']}")
L.append(f"\n失败分类：`{v1['fail_type']}`\n")
for r in rd("T-05/loop.log"):
    L.append(f"- loop.log `{r['ts']}` {r.get('event')} → strategy={r.get('strategy', '-')} "
             f"{r.get('detail') or r.get('evidence', '')}")
v2 = json.loads((A / "T-05" / "verify_r2.json").read_text(encoding="utf-8"))
L.append(f"\n第二轮：passed={v2['passed']}，L3 明细 {[c['detail'] for c in v2['checks'] if c['level'] == 'L3'][0]}")

L.append("\n## 三、调度改派（T-02：并发三路）\n")
for r in rd("T-02/dispatch.log"):
    if r.get("event") in ("rebind", "assign_after_rebind") and str(r.get("task", "")).startswith("N6"):
        L.append(f"- {r['ts']} task={r['task']} {r['event']} "
                 f"{r.get('from', '')}→{r.get('to') or r.get('agent', '')} "
                 f"score={r.get('from_score', r.get('score'))} reason={r.get('reason', '-')}")

L.append("\n## 四、终止条件（不是所有任务都该硬扛到底）\n")
for r in rd("T-09/loop.log") + rd("T-10/loop.log"):
    L.append(f"- {r['ts']} event={r.get('event')} reason={r.get('reason')} "
             f"fail_type={r.get('fail_type')} note={r.get('note', '-')}")
L.append(f"- T-08 转人工：{rd('T-08/loop.log') and rd('T-08/loop.log')[-1].get('reason')}")
for tid in ("T-08", "T-09", "T-10"):
    d = json.loads((A / tid / "run.json").read_text(encoding="utf-8"))
    L.append(f"- {tid} 最终状态：{d['status']}（{d['note']}）")

L.append("\n## 五、必须替换的数字（接真实大模型后重跑，不得沿用）\n")
L.append("1. 上表全部通过率、轮次、P95 延迟；\n2. 单任务成本：骨架只统计 Agent 调用次数，接 LLM 后要换成 token 与金额；\n"
         "3. 并发能力：骨架是子进程并发，真实并发数需另做压测。\n")
L.append("\n## 六、口径声明（写进方案书，避免被判「自证」）\n")
L.append("- 成败判据 = 结果与已知基准真值的偏差 ≤ 0.5（同一把尺子量三档）；\n"
         "- 校验节点不调用生成模型，证据来自独立实现复算与基准比对；\n"
         "- Agent 推理当前为确定性规则实现（离线可跑），接真模型后需重跑全部指标。\n")

out = Path("赛题一_骨架实测日志摘录.md")
out.write_text("\n".join(L) + "\n", encoding="utf-8")
print(f"written: {out} ({out.stat().st_size} bytes, {len(L)} lines)")
