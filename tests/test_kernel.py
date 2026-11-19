# -*- coding: utf-8 -*-
"""内核冒烟测试（纯标准库 unittest，不需要任何第三方依赖、不联网、不调模型）。

跑法：
    python -m unittest discover -s tests -p "test_*.py" -v

覆盖四块最容易回归的逻辑：
  1) 调度打分与高负载改派
  2) 自我循环的三条终止条件 + 歧义转人工
  3) 数据集故障注入与空值率口径
  4) 工具注册表 / 知识库 / 独立复算
"""

import csv
import io
import json
import os
import shutil
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from harness import dataset, kb, tools, verifier  # noqa: E402
from harness.loop import Loop  # noqa: E402
from harness.scheduler import Agent, Scheduler  # noqa: E402


_TMP_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".tmp_tests")
_tmp_seq = [0]


def tmpdir():
    """在仓库内建临时目录：系统 temp 目录在本环境 chmod 被拒，不能用 tempfile。"""
    _tmp_seq[0] += 1
    path = os.path.join(_TMP_ROOT, "t%02d" % _tmp_seq[0])
    os.makedirs(path, exist_ok=True)
    return path


def tearDownModule():
    shutil.rmtree(_TMP_ROOT, ignore_errors=True)


class FakeStore:
    """只记录日志，不落盘；足够驱动 scheduler / loop 的判定逻辑。"""

    def __init__(self):
        self.records = []

    def log(self, tid, channel, **fields):
        self.records.append({"tid": tid, "channel": channel, **fields})
        return fields

    def events(self, channel):
        return [r for r in self.records if r["channel"] == channel]


POLICY = {
    "weights": {"match": 0.4, "load": 0.3, "priority": 0.2, "success": 0.1},
    "min_match": 0.34,
    "high_load": 0.5,
    "max_rounds": 3,
    "max_agent_calls": 40,
    "strategy_map": {
        "tool_fail": "switch_tool",
        "input_data": "refetch",
        "logic": "rewrite",
        "structure": "fix_schema",
    },
}


class SchedulerTest(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        self.agents = [
            Agent({"name": "executor-1", "skills": ["execution", "cleaning"], "capacity": 2}),
            Agent({"name": "executor-2", "skills": ["execution", "cleaning"], "capacity": 2}),
        ]
        self.sched = Scheduler(self.agents, POLICY, self.store)

    def test_空载时负载因子满分且分数高于高负载(self):
        task = {"id": "N5", "skills": ["execution"], "priority": 4}
        idle_score, idle_detail = self.sched.score(task, self.agents[0])
        self.agents[0].running = 2          # 打满 → load = 1.0
        busy_score, busy_detail = self.sched.score(task, self.agents[0])
        self.assertEqual(idle_detail["load"], 0.0)
        self.assertEqual(busy_detail["load"], 1.0)
        self.assertGreater(idle_score, busy_score)

    def test_能力不匹配时分数下降(self):
        task_hit = {"id": "N5", "skills": ["execution"], "priority": 4}
        task_miss = {"id": "N5", "skills": ["literature_review"], "priority": 4}
        hit, _ = self.sched.score(task_hit, self.agents[0])
        miss, _ = self.sched.score(task_miss, self.agents[0])
        self.assertGreater(hit, miss)

    def test_高负载会改派给另一个执行者(self):
        # rebind 的触发条件是"最高分者自身仍高负载"：两个 executor 都打满时，
        # 分数最高的那个仍 load=1.0，于是改派给次高者（并留 rebind 日志）。
        self.agents[0].running = 2
        self.agents[1].running = 2
        task = {"id": "N6", "skills": ["execution"], "priority": 4}
        picked = self.sched.dispatch("T-02", task, "executor")
        rebinds = [e for e in self.store.events("dispatch") if e["event"] == "rebind"]
        self.assertEqual(len(rebinds), 1)
        self.assertEqual(rebinds[0]["reason"], "high_load")
        self.assertEqual(picked.name, "executor-2")

    def test_没有可用角色时返回None并留痕(self):
        task = {"id": "N7", "skills": ["verification"], "priority": 5}
        picked = self.sched.dispatch("T-01", task, "verifier")
        self.assertIsNone(picked)
        self.assertTrue(any(e["event"] == "no_capable_agent" for e in self.store.events("dispatch")))


class LoopTest(unittest.TestCase):
    def setUp(self):
        self.store = FakeStore()
        self.loop = Loop(POLICY, self.store)

    def _verdict(self, fail_type, evidence="boom"):
        return {"fail_type": fail_type, "evidence": evidence}

    def test_通过时不需要修正(self):
        action, reason = self.loop.diagnose("T-01", self._verdict(None), 1, {}, {})
        self.assertEqual((action, reason), ("repair", "passed"))

    def test_需求歧义直接转人工(self):
        action, reason = self.loop.diagnose("T-08", self._verdict("ambiguous"), 1, {}, {})
        self.assertEqual(action, "escalate")
        self.assertEqual(reason, "ambiguous_requires_human")
        self.assertTrue(any(e["event"] == "escalate_human" for e in self.store.events("loop")))

    def test_终止条件一_轮次上限(self):
        action, reason = self.loop.diagnose("T-09", self._verdict("input_data"), 3, {}, {})
        self.assertEqual((action, reason), ("stop", "max_rounds"))

    def test_终止条件二_预算耗尽(self):
        action, reason = self.loop.diagnose("T-09", self._verdict("input_data"), 1,
                                            {"calls": 40}, {})
        self.assertEqual((action, reason), ("stop", "budget"))

    def test_终止条件三_策略去重(self):
        used = {"tool_fail": "switch_tool"}
        action, reason = self.loop.diagnose("T-10", self._verdict("tool_fail"), 2, {}, used)
        self.assertEqual((action, reason), ("stop", "strategy_dedup"))

    def test_首次失败给出策略并记下已用(self):
        used = {}
        action, reason = self.loop.diagnose("T-07", self._verdict("tool_fail"), 1, {}, used)
        self.assertEqual((action, reason), ("repair", "switch_tool"))
        self.assertEqual(used, {"tool_fail": "switch_tool"})


class DatasetTest(unittest.TestCase):
    def test_空值注入三分之一行(self):
        rows = dataset.dirty(dataset.make_clean(n=120, seed=17), "null_ratio")
        empties = [r for r in rows if not (r["value"] or "").strip()]
        self.assertEqual(len(empties), 40)

    def test_量纲混用只影响B组(self):
        rows = dataset.dirty(dataset.make_clean(n=10, seed=7), "unit_mismatch")
        self.assertTrue(all(r["unit"] == "ug" for r in rows if r["group"] == "B"))
        self.assertTrue(all(r["unit"] == "mg" for r in rows if r["group"] == "A"))

    def test_缺列故障会摘掉group列(self):
        rows = dataset.dirty(dataset.make_clean(n=6, seed=7), "missing_group_col")
        self.assertTrue(all("group" not in r for r in rows))


class ToolsTest(unittest.TestCase):
    def setUp(self):
        tools.load(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                "configs", "tools.json"))

    def test_注册表含五个工具且都带schema(self):
        names = tools.names()
        for expected in ("probe_csv", "clean_csv", "run_python", "compare_truth", "kb_search"):
            self.assertIn(expected, names)
        for item in tools.schema():
            self.assertIn("inputSchema", item)

    def test_空值率按不完整的行计算(self):
        rows = dataset.dirty(dataset.make_clean(n=120, seed=17), "null_ratio")
        path = dataset.write_csv(rows, os.path.join(tmpdir(), "dirty.csv"))
        probe = tools.call("probe_csv", path=path)
        self.assertEqual(probe["n_rows"], 120)
        self.assertEqual(probe["null_rows"], 40)
        self.assertAlmostEqual(probe["null_ratio"], 0.3333, places=4)
        self.assertAlmostEqual(probe["null_cell_ratio"], 0.0833, places=4)

    def test_未注册工具抛KeyError(self):
        with self.assertRaises(KeyError):
            tools.call("no_such_tool")


class KbTest(unittest.TestCase):
    def test_检索能返回小节引用(self):
        hits = kb.search("空值 单位", k=2)
        self.assertTrue(hits)
        self.assertIn("#", hits[0]["ref"])
        self.assertTrue(hits[0]["excerpt"])


class VerifierTest(unittest.TestCase):
    def test_相对误差的零误差与定义式(self):
        self.assertEqual(verifier.relative_error(2.5, 2.5), 0.0)
        # 定义式：|platform - truth| / |truth|，单侧基准，不做对称化（别把口径改成双侧）
        self.assertAlmostEqual(verifier.relative_error(2.6, 2.5), 0.04, places=12)
        self.assertAlmostEqual(verifier.relative_error(2.4, 2.5), 0.04, places=12)

    def test_独立复算与生成口径一致(self):
        rows = dataset.make_clean(n=120, seed=7)
        path = dataset.write_csv(rows, os.path.join(tmpdir(), "clean.csv"))
        ref = verifier.independent_recompute(path)
        a = [float(r["value"]) for r in rows if r["group"] == "A"]
        b = [float(r["value"]) for r in rows if r["group"] == "B"]
        expect = sum(b) / len(b) - sum(a) / len(a)
        self.assertEqual((ref["n_a"], ref["n_b"]), (len(a), len(b)))
        self.assertAlmostEqual(ref["diff"], expect, places=9)
        # 两条独立路径（fmean vs 排序累加）必须互相印证
        self.assertAlmostEqual(ref["diff"], ref["diff_manual"], places=9)


if __name__ == "__main__":
    unittest.main(verbosity=2)
