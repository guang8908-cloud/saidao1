# -*- coding: utf-8 -*-
"""把 configs + artifacts 渲染成一个单文件看板 dashboard.html（无需服务器，双击即开）。
用途：录屏时展示"平台界面"——DAG 状态、调度时间线、五级验证判据、自循环轮次。
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent
ART = ROOT / "artifacts"


def read_jsonl(p):
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except Exception:
                pass
    return out


def load_case(case):
    tid = case["id"]
    d = ART / tid
    if not d.exists():
        return None
    run = json.loads((d / "run.json").read_text(encoding="utf-8")) \
        if (d / "run.json").exists() else {}
    disp = read_jsonl(d / "dispatch.log")
    loop = read_jsonl(d / "loop.log")
    ver = read_jsonl(d / "verify.log")
    plan = json.loads((d / "plan.json").read_text(encoding="utf-8")) \
        if (d / "plan.json").exists() else {}
    result = json.loads((d / "result.json").read_text(encoding="utf-8")) \
        if (d / "result.json").exists() else {}
    checks = []
    vs = sorted(d.glob("verify_r*.json"))
    if vs:
        v = json.loads(vs[-1].read_text(encoding="utf-8"))
        checks = v.get("checks", [])
        if not result:
            result = v.get("result") or {}
    # 每个节点被派给谁（按时间顺序，便于看出 rebind）
    nodes = {}
    for e in disp:
        if e.get("event") != "assign":
            continue
        nodes.setdefault(e["task"], []).append(
            {"agent": e.get("agent"), "score": e.get("score"),
             "factors": e.get("factors", {}), "ts": e.get("ts")})
    return {
        "id": tid, "name": case["name"], "status": run.get("status", "untested"),
        "rounds": run.get("rounds", 0), "calls": run.get("agent_calls", 0),
        "dur": run.get("duration_s", 0), "fault": run.get("fault", "none"),
        "fail_type": run.get("fail_type"), "strategy": run.get("strategy"),
        "source": run.get("script_source", "template"),
        "llm_calls": run.get("llm_calls", 0),
        "note": run.get("note", ""),
        "plan": {"goal": plan.get("goal", ""), "steps": plan.get("steps", []),
                 "assumptions": plan.get("assumptions", []),
                 "source": plan.get("source", "rule")},
        "nodes": nodes, "timeline": disp, "verify": ver,
        "loop": [x for x in loop if x.get("event") in
                 ("repair", "repair_applied", "stop", "max_rounds", "dedupe", "pass")],
        "checks": checks, "result": result,
    }


def main():
    cases = json.loads((ROOT / "cases" / "cases.json").read_text(encoding="utf-8"))["cases"]
    wf = json.loads((ROOT / "configs" / "workflow.json").read_text(encoding="utf-8"))
    suite = {}
    p = ART / "suite_table.json"
    if p.exists():
        raw = json.loads(p.read_text(encoding="utf-8"))
        for mode, rows in raw.items():
            ok = sum(1 for r in rows if r["status"] in ("passed", "degraded"))
            n = len(rows)
            ds = sorted(r["duration_s"] for r in rows)
            suite[mode] = {"ok": ok, "n": n,
                           "avg_rounds": round(sum(r["rounds"] for r in rows) / max(1, n), 2),
                           "p95": round(ds[int(0.95 * (n - 1))], 3) if ds else 0,
                           "avg_ms": round(1000 * sum(ds) / max(1, n))}
    data = {
        "title": "溯真 VeriFlow · 多智能体编排与可信验证平台",
        "team": "把爱留在811 · 赛题一 Agent 编排创新应用",
        "workflow": [{"id": n["id"], "kind": n["kind"],
                      "desc": n.get("desc", ""), "skills": n.get("skills", [])}
                     for n in wf["nodes"]],
        "suite": suite,
        "cases": [c for c in (load_case(x) for x in cases) if c],
    }
    html = TEMPLATE.replace("__DATA__", json.dumps(data, ensure_ascii=False))
    out = ROOT / "dashboard.html"
    out.write_text(html, encoding="utf-8")
    print(f"已生成 {out}  ({out.stat().st_size / 1024:.1f} KB, {len(data['cases'])} 条用例)")


TEMPLATE = r"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>溯真 VeriFlow 控制台</title>
<style>
* { box-sizing: border-box; }
body { margin:0; background:#0e1116; color:#e6edf3;
  font: 14px/1.55 "Microsoft YaHei","Segoe UI",system-ui,sans-serif; }
header { padding:16px 24px; border-bottom:1px solid #21262d; display:flex;
  align-items:baseline; gap:16px; flex-wrap:wrap; }
h1 { font-size:18px; margin:0; letter-spacing:.5px; }
.sub { color:#8b949e; font-size:12px; }
.cards { display:flex; gap:12px; padding:14px 24px; flex-wrap:wrap; }
.card { background:#161b22; border:1px solid #21262d; border-radius:8px;
  padding:10px 14px; min-width:190px; }
.card .k { color:#8b949e; font-size:12px; }
.card .v { font-size:22px; font-weight:600; margin-top:2px; }
.card .v small { font-size:12px; color:#8b949e; font-weight:400; }
.chips { padding:0 24px 12px; display:flex; gap:8px; flex-wrap:wrap; }
.chip { border:1px solid #30363d; background:#161b22; color:#c9d1d9;
  border-radius:999px; padding:5px 12px; cursor:pointer; font-size:12px; }
.chip:hover { border-color:#58a6ff; }
.chip.active { background:#1f6feb; border-color:#1f6feb; color:#fff; }
.chip .dot { display:inline-block; width:7px; height:7px; border-radius:50%;
  margin-right:6px; vertical-align:1px; }
main { display:grid; grid-template-columns: 300px 1fr 320px; gap:14px;
  padding:0 24px 28px; align-items:start; }
.panel { background:#0d1117; border:1px solid #21262d; border-radius:10px; padding:12px 14px; }
.panel h2 { font-size:13px; color:#8b949e; font-weight:600; margin:0 0 10px;
  text-transform:uppercase; letter-spacing:.6px; }
.node { border:1px solid #30363d; border-radius:8px; padding:8px 10px; margin-bottom:6px;
  background:#161b22; position:relative; }
.node .nid { font-weight:700; color:#79c0ff; font-size:12px; }
.node .kind { color:#8b949e; font-size:11px; margin-left:6px; }
.node .agents { font-size:11px; margin-top:4px; color:#c9d1d9; word-break:break-all; }
.node.bad { border-color:#f8514966; background:#2d1214; }
.node.good { border-color:#3fb95066; }
.node.skip { opacity:.45; }
.node .score { position:absolute; right:8px; top:8px; font-size:11px; color:#8b949e; }
.arrow { text-align:center; color:#30363d; font-size:11px; margin:-2px 0 4px; }
.arrow.retry { color:#d29922; }
table { width:100%; border-collapse:collapse; font-size:12px; }
th, td { text-align:left; padding:5px 8px; border-bottom:1px solid #21262d; }
th { color:#8b949e; font-weight:500; }
td.mono { font-family:Consolas,monospace; }
.badge { border-radius:4px; padding:1px 6px; font-size:11px; }
.pass { background:#1a7f37; color:#fff; }
.fail { background:#b62324; color:#fff; }
.warn { background:#9e6a03; color:#fff; }
tr.rebind td { background:#2b2109; }
.kv { display:grid; grid-template-columns: 96px 1fr; gap:4px 8px; font-size:12px; }
.kv .k { color:#8b949e; }
.mono-sm { font-family:Consolas,monospace; font-size:11.5px; }
.legend { font-size:11px; color:#8b949e; margin-top:8px; line-height:1.7; }
.status { font-size:12px; padding:1px 8px; border-radius:999px; }
.s-passed { background:#1a7f37; } .s-degraded { background:#9e6a03; }
.s-failed { background:#b62324; } .s-blocked { background:#6e40c9; }
.checks td:first-child { width:44px; }
.tag { font-size:11px; color:#8b949e; border:1px solid #30363d; border-radius:4px;
  padding:0 5px; margin-left:6px; }
</style></head><body>
<header>
  <h1 id="title"></h1>
  <span class="sub" id="team"></span>
  <span class="sub" id="stamp"></span>
</header>
<div class="cards" id="cards"></div>
<div class="chips" id="chips"></div>
<main>
  <section class="panel"><h2>工作流 DAG（N1–N9）</h2><div id="dag"></div>
    <div class="legend">绿=执行通过 · 红=曾失败后被修复 · 灰=本用例未进入<br>
    琥珀数字=该节点被重派次数（rebind）</div>
  </section>
  <section class="panel"><h2>调度时间线（dispatch.log 逐条可核）</h2>
    <div id="timeline"></div>
    <h2 style="margin-top:16px">五级验证判据</h2>
    <div id="checks"></div>
  </section>
  <section class="panel"><h2>自循环</h2><div id="loop"></div>
    <h2 style="margin-top:16px">结果与计划</h2><div id="result"></div>
  </section>
</main>
<script>
const D = __DATA__;
document.getElementById('title').textContent = D.title;
document.getElementById('team').textContent = D.team;
document.getElementById('stamp').textContent = '生成于 ' + new Date().toLocaleString('zh-CN');
const MODES = [['single','单 Agent 直连'],['chain','串行流水线'],['full','本平台（调度+验证+自循环）']];
document.getElementById('cards').innerHTML = MODES.map(([m,label]) => {
  const s = D.suite[m];
  if (!s) return '';
  return `<div class="card"><div class="k">${label}</div>
    <div class="v">${s.ok}/${s.n} <small>任务成功率</small></div>
    <div class="k">平均轮次 ${s.avg_rounds} · P95 ${s.p95}s · 均 ${s.avg_ms}ms</div></div>`;
}).join('');
const chips = document.getElementById('chips');
const DEFAULT_ID = D.cases.some(c => c.id === 'T-07') ? 'T-07' : D.cases[0].id;
D.cases.forEach((c, i) => {
  const b = document.createElement('button');
  b.className = 'chip' + (c.id === DEFAULT_ID ? ' active' : '');
  const color = {passed:'#3fb950', degraded:'#d29922', failed:'#f85149', blocked:'#a371f7'}[c.status] || '#8b949e';
  b.innerHTML = `<span class="dot" style="background:${color}"></span>${c.id} ${c.name}`;
  b.onclick = () => { document.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); render(c); };
  chips.appendChild(b);
});
function render(c) {
  const wf = D.workflow;
  const dag = document.getElementById('dag');
  let html = '';
  wf.forEach(n => {
    const hits = c.nodes[n.id] || [];
    const skips = ['N4'].includes(n.id) && hits.length === 0;
    const bad = hits.length > 1;
    const cnt = hits.length ? hits.length - 1 : 0;
    html += `<div class="node ${bad ? 'bad' : (hits.length ? 'good' : (skips ? 'skip' : ''))}">
      <span class="nid">${n.id}</span><span class="kind">${n.kind}</span>
      ${cnt > 0 ? `<span class="score" style="color:#d29922">重派 ${cnt}×</span>` : ''}
      <div class="agents">${hits.length ? hits.map(h => h.agent + ' · ' + Number(h.score).toFixed(2)).join('<br>') : '未进入'}</div>
    </div>`;
    if (n.id === 'N8') html += `<div class="arrow retry">└─ 未通过 → 回到 N5 ─┘</div>`;
    else if (n.id !== 'N9') html += `<div class="arrow">↓</div>`;
  });
  dag.innerHTML = html;

  const tl = document.getElementById('timeline');
  let rows = '<table><tr><th>时刻</th><th>节点</th><th>Agent</th><th>得分</th><th>match/load/prio/succ</th></tr>';
  c.timeline.forEach(e => {
    if (e.event !== 'assign') return;
    const f = e.factors || {};
    const dup = c.timeline.filter(x => x.event === 'assign' && x.task === e.task).length > 1;
    rows += `<tr class="${dup ? 'rebind' : ''}"><td class="mono">${String(e.ts).slice(11)}</td>
      <td class="mono">${e.task}</td><td class="mono">${e.agent}</td>
      <td class="mono">${Number(e.score).toFixed(2)}</td>
      <td class="mono-sm">${Number(f.match).toFixed(2)}/${Number(f.load).toFixed(2)}/${Number(f.priority).toFixed(2)}/${Number(f.success_rate).toFixed(2)}</td></tr>`;
  });
  rows += '</table>';
  tl.innerHTML = rows;

  const ck = document.getElementById('checks');
  if (!c.checks.length) ck.innerHTML = '<div class="sub">无验证记录</div>';
  else {
    let t = '<table class="checks"><tr><th></th><th>级别</th><th>判据</th><th>证据</th></tr>';
    c.checks.forEach(x => {
      t += `<tr><td><span class="badge ${x.pass ? 'pass' : 'fail'}">${x.pass ? 'PASS' : 'FAIL'}</span></td>
        <td class="mono">${x.level}</td><td>${x.name}</td><td class="mono-sm">${x.detail}</td></tr>`;
    });
    ck.innerHTML = t + '</table>';
  }

  const lp = document.getElementById('loop');
  let lh = `<div class="kv"><div class="k">状态</div><div><span class="status s-${c.status}">${c.status}</span></div>
    <div class="k">轮次</div><div>${c.rounds}</div>
    <div class="k">失败类型</div><div class="mono">${c.fail_type || '—'}</div>
    <div class="k">修复策略</div><div class="mono">${c.strategy || '—'}</div>
    <div class="k">脚本来源</div><div>${c.source === 'llm' ? 'LLM 生成' : '已验证模板'}<span class="tag">LLM 调用 ${c.llm_calls}</span></div></div>`;
  if (c.loop.length) {
    lh += '<table style="margin-top:8px"><tr><th>轮</th><th>事件</th><th>详情</th></tr>';
    c.loop.forEach(e => {
      lh += `<tr><td class="mono">${e.round || '-'}</td><td class="mono">${e.event}</td>
        <td class="mono-sm">${e.detail || e.strategy || e.evidence || ''}</td></tr>`;
    });
    lh += '</table>';
  }
  lp.innerHTML = lh;

  const r = c.result || {};
  const pick = ['mean_a','mean_b','diff','n_a','n_b','truth_diff','note'];
  let rh = '<div class="kv">';
  pick.filter(k => r[k] !== undefined && r[k] !== null).forEach(k => {
    rh += `<div class="k">${k}</div><div class="mono">${typeof r[k] === 'number' ? r[k].toFixed(4) : r[k]}</div>`;
  });
  rh += `<div class="k">计划来源</div><div>${c.plan.source === 'llm' ? 'Planner Agent（LLM）' : '规则模板'}</div>`;
  rh += `<div class="k">备注</div><div>${c.note || '—'}</div></div>`;
  if (c.plan.steps && c.plan.steps.length) {
    rh += '<div class="sub" style="margin-top:8px">计划步骤：' + c.plan.steps.join(' → ') + '</div>';
  }
  document.getElementById('result').innerHTML = rh;
}
render(D.cases.find(c => c.id === DEFAULT_ID) || D.cases[0]);
</script></body></html>
"""


if __name__ == "__main__":
    main()
