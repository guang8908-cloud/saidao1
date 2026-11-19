# -*- coding: utf-8 -*-
"""命令行入口：
  python -m harness run   --case T-07              # 跑单条
  python -m harness suite [--mode all]             # 跑全部 10 条 × 三档基线
  python -m harness show  --case T-07              # 看这条的日志与验证结论
  python -m harness metrics                        # 汇总指标
"""
import argparse
import json
import sys
from pathlib import Path

from .orchestrator import Orchestrator
from . import metrics as M


def _load_cases(path="cases/cases.json"):
    return json.loads(Path(path).read_text(encoding="utf-8"))["cases"]


def main(argv=None):
    ap = argparse.ArgumentParser(prog="harness")
    sub = ap.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("run")
    r.add_argument("--case", required=True)
    r.add_argument("--mode", default="full", choices=["single", "chain", "full"])
    r.add_argument("--llm", action="store_true", help="用 DeepSeek 驱动规划/生成/诊断/报告（无 Key 自动降级）")

    s = sub.add_parser("suite")
    s.add_argument("--mode", default="all", choices=["single", "chain", "full", "all"])
    s.add_argument("--llm", action="store_true")

    sh = sub.add_parser("show")
    sh.add_argument("--case", required=True)

    sub.add_parser("metrics")

    tp = sub.add_parser("tools", help="打印工具注册表（JSON Schema）")
    tp.add_argument("--schema", action="store_true")

    kbp = sub.add_parser("kb", help="检索本地方法说明库")
    kbp.add_argument("--query", required=True)
    kbp.add_argument("-k", type=int, default=3)

    args = ap.parse_args(argv)
    use_llm = bool(getattr(args, "llm", False))
    orch = Orchestrator(use_llm=use_llm)

    if args.cmd == "run":
        case = next(c for c in _load_cases() if c["id"] == args.case)
        rec = orch.run_case(case, mode=args.mode)
        print(json.dumps(rec, ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "suite":
        modes = ["single", "chain", "full"] if args.mode == "all" else [args.mode]
        table = {}
        for mode in modes:
            rows = []
            for case in _load_cases():
                o = Orchestrator(use_llm=use_llm)
                rows.append(o.run_case(case, mode=mode))
            table[mode] = rows
            n = len(rows)
            ok = sum(1 for x in rows if x["status"] in ("passed", "degraded"))
            print(f"[{mode:6s}] 通过 {ok}/{n}  平均轮次 "
                  f"{sum(x['rounds'] for x in rows) / n:.2f}  "
                  f"P95 {sorted(x['duration_s'] for x in rows)[int(0.95 * (n - 1))]:.2f}s")
        print()
        print("用例   " + "  ".join(f"{m:>7s}" for m in modes))
        for i, case in enumerate(_load_cases()):
            line = f"{case['id']}  " + "  ".join(
                f"{table[m][i]['status'][:7]:>7s}" for m in modes)
            print(line)
        out = Path("artifacts") / "suite_table.json"
        out.write_text(json.dumps(table, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n明细已写入 {out}")
        return 0

    if args.cmd == "show":
        d = Path("artifacts") / args.case
        for name in ("run.json", "report.md", "probe.json", "plan.json"):
            p = d / name
            if p.exists():
                print(f"===== {name} =====")
                print(p.read_text(encoding="utf-8"))
        v = sorted(d.glob("verify_r*.json"))
        if v:
            vv = json.loads(v[-1].read_text(encoding="utf-8"))
            print(f"===== {v[-1].name} =====")
            print(json.dumps(vv, ensure_ascii=False, indent=2)[:2000])
        return 0

    if args.cmd == "metrics":
        agg = M.aggregate()
        print(json.dumps({k: v for k, v in agg.items() if k != "rows"},
                         ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "tools":
        from . import tools as T
        print(json.dumps(T.schema() if args.schema else
                         [{"name": n} for n in T.names()],
                         ensure_ascii=False, indent=2))
        return 0

    if args.cmd == "kb":
        from . import kb as K
        print(json.dumps(K.search(args.query, k=args.k), ensure_ascii=False, indent=2))
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
