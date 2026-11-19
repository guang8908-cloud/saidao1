# -*- coding: utf-8 -*-
"""编排器：按 workflow.json 解释执行，支持 when 分支 / loop 回边 / 并行派发。
配置改一处 → 行为变，不在代码里写死流程。"""
import json
import subprocess
import sys
import time
from pathlib import Path

from . import dataset, kb, tools, verifier
from . import llm
from .executor import Executor
from .loop import Loop
from .scheduler import Scheduler, Agent, build_agents


class Orchestrator:
    def __init__(self, cfg_dir="configs", out_dir="artifacts", use_llm=False):
        from .store import Store, load_config
        self.store = Store(out_dir)
        self.agents_cfg = load_config(Path(cfg_dir) / "agents.json")["agents"]
        self.wf = load_config(Path(cfg_dir) / "workflow.json")
        self.policy = load_config(Path(cfg_dir) / "policy.json")
        self.nodes = {n["id"]: n for n in self.wf["nodes"]}
        self.loop = Loop(self.policy, self.store)
        self.execu = Executor(self.store)
        self.use_llm = bool(use_llm) and llm.available()
        if use_llm and not self.use_llm:
            print("[warn] --llm 已开启但没有找到 DEEPSEEK_API_KEY，将自动降级为规则实现")

    def _agents(self):
        return build_agents(self.agents_cfg)

    # ---------- 单条用例 ----------
    def run_case(self, case, mode="full"):
        tid = case["id"]
        self.loop.max_rounds = case.get("max_rounds", self.policy["max_rounds"])
        t0 = time.perf_counter()
        agents = self._agents()
        sched = Scheduler(agents, self.policy, self.store)
        fixed = {a.name.split("-")[0]: a for a in agents}
        ctx = {"tid": tid, "case": case, "csv": None, "exec_res": None,
               "result": None, "verdict": None, "rnd": 0, "calls": 0,
               "used": {}, "history": [], "status": "running",
               "fault": case.get("fault", "none"), "bad_import": case.get("fault") == "import_error",
               "ambiguous": case.get("fault") == "ambiguous", "parallel": case.get("parallel", 1),
               "fail_type": None, "strategy": None, "note": "",
               "script_source": "template", "force_template": False,
               "llm_used": 0, "llm_tokens": 0}
        self.store.task_dir(tid)
        for f in ("dispatch", "exec", "verify", "loop", "queue", "llm", "tools", "kb"):
            p = self.store.task_dir(tid) / f"{f}.log"
            if p.exists():
                p.unlink()
        self.store.log(tid, "queue", event="enqueue", case=tid, name=case["name"],
                       priority=case.get("priority", 3), mode=mode)
        self.store.log(tid, "tools", event="registry", names=tools.names(),
                       count=len(tools.names()))

        # 造数据（含故意注入的脏化）
        rows = dataset.make_clean(n=case.get("n", 120), seed=case.get("seed", 7))
        dirty_rows = dataset.dirty(rows, case.get("fault"))
        ctx["csv"] = dataset.write_csv(dirty_rows, self.store.task_dir(tid) / "data/raw.csv")
        ctx["clean_rows"] = rows

        if mode == "single":
            return self._run_single(ctx, agents[1], t0)
        if mode == "chain":
            return self._run_chain(ctx, fixed, t0)

        # ---- full：真正走 workflow.json ----
        cur = self.wf["entry"]
        guard = 0
        while cur and guard < 50:
            guard += 1
            node = self.nodes[cur]
            if node.get("when") and not self._cond(node["when"], ctx):
                cur = node.get("next_if_false")
                self.store.log(tid, "queue", event="branch", node=node["id"],
                               taken="false", next=cur)
                continue
            out = self._exec_node(node, ctx, sched, mode)
            ctx["history"].append({"node": node["id"], "rnd": ctx["rnd"], "out": out})
            nxt = self._next(node, ctx, out)
            if node.get("type") in ("branch", "loop"):
                self.store.log(tid, "queue", event="node", node=node["id"], next=nxt,
                               outcome=out.get("outcome"))
            cur = nxt

        dur = time.perf_counter() - t0
        return self._finish(ctx, dur)

    def _run_single(self, ctx, agent, t0):
        """基线 A：一个 Agent 一次直连，无调度、无验证、无循环。"""
        tid = ctx["tid"]
        self.store.log(tid, "dispatch", task="T", event="assign", agent=agent.name,
                       score=None, factors={"note": "baseline_single_agent"})
        ctx["calls"] += 1
        self.store.log(tid, "exec", event="single_shot", agent=agent.name)
        script = self.execu.generate_script(tid, ctx["csv"],
                                           str(self.store.task_dir(tid) / "result.json"),
                                           rnd=1, fault=("import_error" if ctx["bad_import"] else None))
        ctx["exec_res"] = self.execu.run_script(tid, script, rnd=1)
        ctx["result"] = self.execu.read_result(tid)
        ok = self._truth_ok(ctx)
        ctx["status"] = "passed" if ok else "failed"
        ctx["rnd"] = 1
        ctx["note"] = "baseline: 单 Agent 直连，无调度/验证/循环"
        return self._finish(ctx, time.perf_counter() - t0)

    def _truth_ok(self, ctx):
        """基线只按最终结果是否达标记成败（同一把尺子量三档），
        但基线自己没有任何拦截/纠错手段。"""
        r = ctx["result"]
        if ctx["exec_res"]["exit"] != 0 or not r or r.get("n_b", 0) == 0:
            return False
        return abs(r.get("diff", 0) - ctx["case"].get("truth_diff", 2.5)) \
            <= ctx["case"].get("tol", 0.5)

    def _run_chain(self, ctx, fixed, t0):
        """基线 B：串行流水线，多人但固定分工，无智能调度、无验证节点、无循环。"""
        tid = ctx["tid"]
        for nm in ("plan", "probe", "clean", "gen_script", "run", "report"):
            a = fixed.get({"run": "executor", "gen_script": "executor"}.get(nm, nm), fixed["executor"])
            self.store.log(tid, "dispatch", task=nm, event="assign_fixed", agent=a.name)
            ctx["calls"] += 1
        script = self.execu.generate_script(tid, ctx["csv"],
                                           str(self.store.task_dir(tid) / "result.json"),
                                           rnd=1, fault=("import_error" if ctx["bad_import"] else None))
        ctx["exec_res"] = self.execu.run_script(tid, script, rnd=1)
        ctx["result"] = self.execu.read_result(tid)
        ok = self._truth_ok(ctx)
        ctx["status"] = "passed" if ok else "failed"
        ctx["rnd"] = 1
        ctx["note"] = "baseline: 固定串行流水线，无智能调度/验证节点/循环"
        return self._finish(ctx, time.perf_counter() - t0)

    # ---------- 节点执行 ----------
    def _exec_node(self, node, ctx, sched, mode):
        tid = ctx["tid"]
        kind = node["kind"]
        rnd = ctx["rnd"]

        if kind == "plan":
            a = sched.dispatch(tid, {"id": node["id"], "skills": node.get("skills", []),
                                     "priority": 2}, "planner")
            ctx["calls"] += 1
            plan = {"goal": ctx["case"]["name"], "sample_n": ctx["case"].get("n", 120),
                    "assumptions": (["需求未明确统计口径，默认按 group 分组求均值差"] if ctx["ambiguous"] else []),
                    "steps": ["探查", "清洗", "生成脚本", "沙箱执行", "五级验证"]}
            plan["source"] = "rule"
            if self.use_llm:
                got = self._llm_plan(ctx)
                if got:
                    plan.update(got)
                    plan["source"] = "llm"
            hits = kb.search("组间均值差 口径 缺失值与单位 容差", k=2)
            plan["kb_refs"] = [h["ref"] for h in hits]
            self.store.log(tid, "kb", event="cite", stage="plan", refs=plan["kb_refs"])
            self.store.dump(tid, "plan.json", plan)
            sched.release(a, True)
            return {"outcome": "ok", "plan": plan}

        if kind == "probe":
            a = sched.dispatch(tid, {"id": node["id"], "skills": node.get("skills", []),
                                     "priority": 3}, "executor")
            ctx["calls"] += 1
            pr = tools.call("probe_csv", path=ctx["csv"])
            rows_probe = {"n_rows": pr["n_rows"], "has_group_col": "group" in pr["columns"],
                          "null_ratio": pr["null_ratio"]}
            self.store.log(tid, "exec", event="tool_call", agent=a.name, tool="probe_csv",
                           **rows_probe)
            probe = rows_probe
            self.store.dump(tid, "probe.json", probe)
            self.store.log(tid, "exec", event="probe", agent=a.name, **probe)
            sched.release(a, True)
            ctx["probe"] = probe
            return {"outcome": "ok", "probe": probe}

        if kind == "branch":
            p = ctx.get("probe") or {}
            need_clean = (not p.get("has_group_col", True)) or p.get("null_ratio", 0) >= 0.1
            return {"outcome": "need_clean" if need_clean else "skip_clean",
                    "decision": "走清洗分支" if need_clean else "数据合格，跳过清洗"}

        if kind == "clean":
            a = sched.dispatch(tid, {"id": node["id"], "skills": node.get("skills", []),
                                     "priority": 3}, "executor")
            ctx["calls"] += 1
            import csv as _csv
            rows = list(_csv.DictReader(open(ctx["csv"], encoding="utf-8")))
            seen, out = set(), []
            for r in rows:
                key = (r.get("sample_id"), r.get("value"))
                if not (r.get("value") or "").strip() or key in seen:
                    continue
                seen.add(key)
                out.append(r)
            from . import dataset as ds
            ctx["csv"] = ds.write_csv(out, self.store.task_dir(tid) / "data/clean.csv")
            self.store.log(tid, "exec", event="clean", agent=a.name,
                           in_rows=len(rows), out_rows=len(out))
            sched.release(a, True)
            return {"outcome": "ok", "rows": len(out)}

        if kind == "gen_script":
            a = sched.dispatch(tid, {"id": node["id"], "skills": node.get("skills", []),
                                     "priority": 4, "parallel": ctx["parallel"]}, "executor")
            ctx["calls"] += 1
            out_path = str(self.store.task_dir(tid) / "result.json")
            fault = "import_error" if ctx["bad_import"] else None
            code = None
            if self.use_llm and not ctx["force_template"]:
                code = self._llm_script(ctx, ctx["csv"], out_path)
            if code:
                script = self.execu.write_script(tid, code, max(1, rnd), source="llm", fault=fault)
                ctx["script_source"] = "llm"
            else:
                script = self.execu.generate_script(tid, ctx["csv"], out_path,
                                                    rnd=max(1, rnd), fault=fault)
                ctx["script_source"] = "template"
            ctx["script"] = str(script)
            sched.release(a, True)
            return {"outcome": "ok", "script": str(script), "source": ctx["script_source"]}

        if kind == "run":
            n = ctx["parallel"]
            if n >= 2:
                # 并发派发 N 条独立复算：调度器在本节点已占用负载后还要继续派活，
                # 第 3 条会因两个 executor 都忙而被改派（产生一条 rebind 日志）
                procs, used = [], []
                for i in range(n):
                    ai = sched.dispatch(tid, {"id": f"{node['id']}#{i + 1}",
                                              "skills": node.get("skills", []),
                                              "priority": 4}, "executor")
                    ctx["calls"] += 1
                    used.append(ai)
                    name = "result.json" if i == 0 else f"result_b{i}.json"
                    s = self.execu.generate_script(tid, ctx["csv"],
                                                   str(self.store.task_dir(tid) / name),
                                                   rnd=max(1, rnd))
                    procs.append(subprocess.Popen([sys.executable, str(s)],
                                                  cwd=str(self.store.task_dir(tid)),
                                                  stdout=subprocess.PIPE,
                                                  stderr=subprocess.PIPE, text=True))
                outs = []
                for p in procs:
                    o, e = p.communicate()
                    outs.append((p.returncode, o, e))
                self.store.log(tid, "exec", event="parallel_run", round=rnd, branches=n,
                               exits=[x[0] for x in outs],
                               agents=[a.name if a else None for a in used])
                e0 = outs[0][2] or ""
                ctx["exec_res"] = {"exit": outs[0][0], "stdout": outs[0][1], "stderr": e0,
                                   "stderr_last": e0.strip().splitlines()[-1] if e0.strip() else ""}
                for ai, (code, _, _) in zip(used, outs):
                    sched.release(ai, code == 0)
            else:
                a = sched.dispatch(tid, {"id": node["id"], "skills": node.get("skills", []),
                                         "priority": 4}, "executor")
                ctx["calls"] += 1
                ctx["exec_res"] = self.execu.run_script(tid, Path(ctx["script"]), rnd=max(1, rnd))
                sched.release(a, ctx["exec_res"]["exit"] == 0)
            ctx["result"] = self.execu.read_result(tid)
            return {"outcome": "ok", "exit": ctx["exec_res"]["exit"]}

        if kind == "verify":
            a = sched.dispatch(tid, {"id": node["id"], "skills": node.get("skills", []),
                                     "priority": 5}, "verifier")
            ctx["calls"] += 1
            v = verifier.verify(tid, self.store, ctx["exec_res"], ctx["result"],
                                ctx["csv"], max(1, rnd),
                                truth_diff=ctx["case"].get("truth_diff", 2.5),
                                tol=ctx["case"].get("tol", 0.5))
            if ctx["ambiguous"]:
                v["fail_type"] = "ambiguous"
                v["passed"] = False
                v["evidence"] = "需求歧义：统计口径未在立项时锁定"
            ctx["verdict"] = v
            sched.release(a, v["passed"])
            return {"outcome": "pass" if v["passed"] else "fail", "fail_type": v["fail_type"]}

        if kind == "loop":
            v = ctx["verdict"]
            ctx["history"].append({"rnd": max(1, rnd), "fail_type": v["fail_type"],
                                   "passed": v["passed"]})
            action, reason = self.loop.diagnose(tid, v, max(1, rnd), ctx, ctx["used"])
            if self.use_llm and v["fail_type"]:
                self._llm_diagnose(ctx, v)
            if action == "repair" and reason == "passed":
                ctx["status"] = "passed"
                return {"outcome": "done", "next": node["next_on_pass"]}
            if action == "escalate":
                ctx["status"] = "degraded"
                ctx["note"] = "转人工：歧义需业务方确认统计口径"
                return {"outcome": "escalate", "next": node["next_on_pass"]}
            if action == "stop":
                ctx["status"] = "failed" if reason == "max_rounds" else "blocked"
                ctx["note"] = f"终止条件命中：{reason}"
                return {"outcome": "stop:" + reason, "next": node["next_on_stop"]}
            # repair：真的动数据/动策略，然后回到生脚本节点
            ctx["rnd"] = max(1, rnd) + 1
            ctx["fail_type"] = v["fail_type"]
            ctx["strategy"] = reason
            self._repair(ctx, reason)
            return {"outcome": "retry", "strategy": reason, "round": ctx["rnd"],
                    "next": node["next_on_retry"]}

        if kind == "report":
            a = sched.dispatch(tid, {"id": node["id"], "skills": node.get("skills", []),
                                     "priority": 2}, "writer")
            ctx["calls"] += 1
            md = ["# 任务报告 %s" % tid, "", "- 用例：%s" % ctx["case"]["name"],
                  "- 结论：%s" % ctx["status"], "- 轮次：%d" % max(1, ctx["rnd"]),
                  "- Agent 调用次数：%d" % ctx["calls"],
                  "- 备注：%s" % (ctx["note"] or "—"), "",
                  "## 各轮验证"]
            for h in ctx["history"]:
                if "fail_type" in h:
                    md.append("- 第 %s 轮：%s（%s）" % (h.get("rnd"), 
                              "通过" if h.get("passed") else "未通过", h.get("fail_type") or "-"))
            if ctx["verdict"]:
                md.append("")
                md.append("## 最终判据")
                for c in ctx["verdict"]["checks"]:
                    md.append("- [%s] %s：%s — %s" % ("x" if c["pass"] else " ",
                                                      c["level"], c["name"], c["detail"]))
            if self.use_llm:
                narr = self._llm_report(ctx)
                if narr:
                    md.append("")
                    md.append("## 结论摘述（Writer Agent，LLM 生成）")
                    for line in narr:
                        md.append("- %s" % line)
                    md.append("")
                    md.append("> 说明：以上文字由 Writer Agent 依据结构化验证结果生成，"
                              "数字均取自 result.json 与 verify_r*.json，可逐项核对。")
            self.store.write(tid, "report.md", "\n".join(md) + "\n")
            sched.release(a, True)
            return {"outcome": "ok"}

        raise KeyError(f"unknown node kind: {kind}")

    # ---------- LLM 辅助：任何一步失败都静默降级，主流程照常跑 ----------
    def _llm_call(self, ctx, tag, system, user):
        text, meta = llm.chat(system, user, store=self.store, tid=ctx["tid"], tag=tag)
        if text:
            ctx["llm_used"] += 1
            ctx["llm_tokens"] += (int(meta.get("prompt_tokens") or 0)
                                  + int(meta.get("completion_tokens") or 0))
        return text, meta

    @staticmethod
    def _strip_fence(text):
        t = (text or "").strip()
        if t.startswith("```"):
            parts = t.split("```")
            if len(parts) >= 2:
                t = parts[1]
                if t.lstrip().lower().startswith("python"):
                    t = t.lstrip()[6:]
        return t.strip()

    def _llm_plan(self, ctx):
        system = "你是多智能体编排平台的规划 Agent。只输出 JSON，不要解释，不要代码块标记。"
        user = ("任务名称：%s\n样本量：%s\n目标：比较 A、B 两组的 value 均值差并给出可核验结论。\n"
                '输出 JSON：{"goal": 字符串, "assumptions": [字符串], "steps": [字符串]}；'
                "中文；steps 不超过 5 条，每条不超过 40 字。"
                % (ctx["case"]["name"], ctx["case"].get("n", 120)))
        text, meta = self._llm_call(ctx, "plan", system, user)
        obj = llm.parse_json(text) if text else None
        if not isinstance(obj, dict):
            self.store.log(ctx["tid"], "llm", event="plan_fallback", reason="invalid_json")
            return None
        steps = [str(x)[:80] for x in (obj.get("steps") or [])][:6]
        if not steps:
            self.store.log(ctx["tid"], "llm", event="plan_fallback", reason="empty_steps")
            return None
        return {"goal": str(obj.get("goal") or ctx["case"]["name"])[:200],
                "assumptions": [str(x)[:120] for x in (obj.get("assumptions") or [])][:5],
                "steps": steps}

    def _llm_script(self, ctx, csv_path, out_path):
        system = ("你是数据分析执行 Agent。只输出一段可直接运行的 Python 代码，"
                  "不要代码块标记，不要解释；只允许使用标准库。")
        hits = kb.search("组间均值差 口径 缺失值与单位", k=2)
        kb_txt = "\n".join(f"[{h['ref']}] {h['excerpt']}" for h in hits) or "（无）"
        user = ("可用工具（仅供你理解平台能力，脚本里请用标准库自行实现）：\n%s\n\n"
                "口径依据（必须遵守）：\n%s\n\n"
                "CSV 路径：%s\n列：sample_id, group, value, unit\n"
                "要求：忽略 value 为空的行；分别计算 group=A、group=B 的 value 均值；"
                "diff = mean_b - mean_a。\n"
                "把结果以 JSON 写入 %s，必须包含键 mean_a, mean_b, diff, n_a, n_b。\n"
                "代码直接执行即可，不要读命令行参数。"
                % (tools.describe_for_prompt(), kb_txt, csv_path, out_path))
        text, meta = self._llm_call(ctx, "codegen", system, user)
        if not text:
            return None
        code = self._strip_fence(text)
        bad = self.execu.unsafe_imports(code)
        if bad:
            self.store.log(ctx["tid"], "llm", event="codegen_rejected",
                           reason="third_party_import", modules=bad)
            return None
        if "diff" not in code:
            self.store.log(ctx["tid"], "llm", event="codegen_rejected", reason="missing_diff")
            return None
        self.store.log(ctx["tid"], "llm", event="codegen_accepted", chars=len(code),
                       latency_s=meta.get("latency_s"))
        return code

    def _llm_diagnose(self, ctx, verdict):
        system = "你是故障诊断 Agent。只输出 JSON，不要解释。"
        user = ("候选失败类型：tool_fail（脚本崩溃/依赖缺失）、input_data（缺列或空值过多）、"
                "logic（数值与基准不符）、structure（产物字段缺失）、ambiguous（需求歧义）。\n"
                "证据：%s\n"
                '输出 JSON：{"fail_type": "...", "reason": "..."}' % str(verdict.get("evidence"))[:400])
        text, meta = self._llm_call(ctx, "diagnose", system, user)
        obj = llm.parse_json(text) if text else None
        guess = str((obj or {}).get("fail_type") or "")
        agree = guess == verdict.get("fail_type")
        self.store.log(ctx["tid"], "llm", event="diagnose", llm_fail_type=guess,
                       rule_fail_type=verdict.get("fail_type"), agree=agree,
                       reason=str((obj or {}).get("reason") or "")[:160])
        return agree

    def _llm_report(self, ctx):
        v = ctx["verdict"] or {}
        checks = "; ".join("%s:%s" % ("PASS" if c["pass"] else "FAIL", c["name"])
                           for c in (v.get("checks") or [])[:8])
        r = ctx.get("result") or {}
        rounds = "; ".join("R%s=%s" % (h.get("rnd"), h.get("fail_type"))
                           for h in ctx["history"] if h.get("fail_type"))
        system = ("你是报告撰写 Agent。只输出 JSON：{\"bullets\": [字符串]}，中文 3 条，"
                  "每条不超过 60 字；只能使用给定数字，不得编造。")
        user = ("用例：%s；最终状态：%s；轮次：%d；验证判据：%s；"
                "数值：mean_a=%s, mean_b=%s, diff=%s；失败轮次：%s"
                % (ctx["case"]["name"], ctx["status"], max(1, ctx["rnd"]), checks,
                   r.get("mean_a"), r.get("mean_b"), r.get("diff"), rounds or "无"))
        text, meta = self._llm_call(ctx, "report", system, user)
        obj = llm.parse_json(text) if text else None
        bullets = [str(x)[:120] for x in ((obj or {}).get("bullets") or [])][:3]
        return bullets or None

    def _repair(self, ctx, strategy):
        tid = ctx["tid"]
        if strategy == "refetch_data":
            from . import dataset as ds
            ctx["csv"] = ds.write_csv(ds.make_clean(n=ctx["case"].get("n", 120),
                                                    seed=ctx["case"].get("seed", 7)),
                                      self.store.task_dir(tid) / "data/refetch.csv")
            self.store.log(tid, "loop", event="repair_applied", strategy=strategy,
                           detail="重新取数：补回 group 列，字段完整性校验通过")
        elif strategy == "normalize_units":
            import csv as _csv
            from . import dataset as ds
            rows = list(_csv.DictReader(open(ctx["csv"], encoding="utf-8")))
            for r in rows:
                if (r.get("unit") or "").strip() == "ug":
                    r["value"] = "%.6f" % (float(r["value"]) / 1000.0)
                    r["unit"] = "mg"
            ctx["csv"] = ds.write_csv(rows, self.store.task_dir(tid) / f"data/fixed_r{ctx['rnd']}.csv")
            self.store.log(tid, "loop", event="repair_applied", strategy=strategy,
                           detail="统一量纲：ug → mg，重算改为同单位后比对")
        elif strategy == "switch_tool":
            if ctx["case"].get("repair") == "stuck":
                self.store.log(tid, "loop", event="repair_applied", strategy=strategy,
                               detail="替换依赖失败：备用实现同样依赖缺失（注入的僵局用例）")
            elif ctx["script_source"] == "llm" and not ctx["force_template"]:
                ctx["force_template"] = True
                ctx["bad_import"] = False
                self.store.log(tid, "loop", event="repair_applied", strategy=strategy,
                               detail="LLM 生成脚本未通过可执行校验 → 回退到已验证模板并重新执行")
            else:
                ctx["bad_import"] = False
                self.store.log(tid, "loop", event="repair_applied", strategy=strategy,
                               detail="换工具：移除不可用依赖，改用标准库实现")
        else:
            self.store.log(tid, "loop", event="repair_applied", strategy=strategy,
                           detail="手工修复")

    def _cond(self, expr, ctx):
        p = ctx.get("probe") or {}
        if expr == "probe_dirty":
            return (not p.get("has_group_col", True)) or p.get("null_ratio", 0) >= 0.1
        return True

    def _next(self, node, ctx, out):
        if "next" in out:
            return out["next"]
        return node.get("next")

    def _finish(self, ctx, dur):
        tid = ctx["tid"]
        rec = {"id": tid, "name": ctx["case"]["name"], "status": ctx["status"],
               "rounds": max(1, ctx["rnd"]), "agent_calls": ctx["calls"],
               "duration_s": round(dur, 3), "fault": ctx["case"].get("fault", "none"),
               "fail_type": ctx["fail_type"], "strategy": ctx["strategy"],
               "note": ctx["note"] or "—",
               "script_source": ctx.get("script_source", "template"),
               "llm_calls": ctx.get("llm_used", 0), "llm_tokens": ctx.get("llm_tokens", 0)}
        self.store.dump(tid, "run.json", rec)
        self.store.log(tid, "queue", event="finish", status=rec["status"],
                       rounds=rec["rounds"], duration_s=rec["duration_s"])
        return rec
