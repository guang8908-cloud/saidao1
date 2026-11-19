# 仲园智能体平台 · 多智能体编排与可信验证

> 第五届「未来杯」创新大赛 · 赛题一（Agent 编排创新应用）
> 队伍：把爱留在811（何镇广、刘凯辉）
> 版本：v1.0 初赛提交（2026-11-19）

这是一个**面向多智能体协作的编排、调度、执行与验证平台**。它解决的不是"能不能调通大模型"，而是三件在工程上更难的事：

1. **派活要有依据**——每次把任务分给哪个 Agent，都留下打分依据（能力匹配 / 负载 / 优先级 / 历史成功率），事后可复盘。
2. **干错要拦得住**——五级验证判据，从结构、可执行、基准真值、独立复算到人工放行，逐级拦住错误，不靠"再问一个模型它对不对"。
3. **错了要能自己修**——失败分类 → 修正策略 → 重执行，最多 3 轮，且能收敛也能认输（转人工 / 放弃 / 策略去重判死）。

基准场景是**科研数据分析**（取数清洗 → 生成脚本 → 沙箱执行 → 数值核对 → 出报告），因为这类任务有客观对错，验证判据是机器可判的，不能靠话术糊弄过去。平台同时预留了外部智能体接入位（例如校园问答机器人），见附录 E。

---

## 快速开始

### 1. 编排内核（不需要任何第三方依赖，只要 Python 3.10+）

```bash
python -m harness run --case T-07      # 单条用例：依赖缺失 → 自己修好 → 通过
python -m harness suite --mode all     # 10 条用例 × 三档基线（single / chain / full）
python -m harness metrics              # 汇总指标
python -m harness show --case T-05     # 看某条用例的执行细节
```

产物全部落在 `artifacts/<用例号>/`：`plan.json`、`dispatch.log`（调度决策）、`exec.log`、`verify_r1.json` / `verify_r2.json`（每轮五级判据）、`loop.log`（循环事件）、`result.json`、`report.md`。

### 2. Web 控制台（Next.js）

```bash
pnpm install
pnpm dev          # http://127.0.0.1:5000/console
```

控制台页面 `/console` 会调用 `python -m harness`，把计划、调度时间线、五级判据、自循环事件、三档基线对比直接渲染出来。页面只做展示，数字全部来自 `artifacts/`。

### 3. 接真实大模型（可选，不接也能跑通全流程）

复制 `.env.example` 为 `.env.local`，填 `LLM_API_KEY`。这一份配置同时被 Next.js 聊天接口和 Python 内核读取（内核会自动补 `/v1`）。

不配 Key 时，规划、生成脚本、诊断、报告四个环节退回确定性实现，全流程依然可跑、可复现——这是刻意的设计：**评审 clone 下来不需要任何密钥就能看到完整日志**。

---

## 实测结果（同一批 10 条用例）

口径：接真实模型（DeepSeek 官方端点 `api.deepseek.com`，模型 `deepseek-chat`，temperature=0）。

| 档位 | 说明 | 交付 | 平均轮次 | P95 |
|---|---|---|---|---|
| single | 单 Agent 直连，无调度、无验证、无循环 | 5 / 10 | 1.00 | 0.07 s |
| chain | 串行流水线，无调度、无验证 | 5 / 10 | 1.00 | 0.07 s |
| full | 本平台（调度 + 五级验证 + 自循环） | **9 / 10** | **1.30** | 13.74 s |

10 条用例共 **37 次模型调用、18151 tokens**（平均 1815 tokens/任务）；两档基线不调用模型（`llm_calls=0`），
所以它们的耗时只代表「不推理」的成本，两者差异量化的正是"让不让模型参与规划与生成"。

**9/10 不是没做完，是设计出来的**：

| 用例 | 结果 | 为什么这是对的 |
|---|---|---|
| T-08 | degraded（转人工） | 数据本身不可判，平台应当承认判不了，而不是硬给一个数 |
| T-10 | blocked（策略去重判死） | 同一修正策略重复出现，判定为死循环并终止，不再烧 token |

一个只会报"全部通过"的平台，是没有验证能力的。

不配 Key 时内核自动降级为确定性实现（机制完全一样、数字会变）：三档为 5 / 5 / 8、平均 1.40 轮、P95 0.21 s。
两组数据不混用——方案书里的正式指标是上面这一组（接真模型）。

一个只会报"全部通过"的平台，是没有验证能力的。

---

## 架构：为什么是「TS 控制台 + Python 内核」

```
浏览器 (Next.js /console)
      │  GET /api/orchestrate?case=T-07
      ▼
src/app/api/orchestrate/route.ts
      │  spawn: python -m harness run --case T-07
      ▼
harness/  ← 编排内核（纯标准库）
  orchestrator.py  DAG 执行 · 任务生命周期
  scheduler.py     四因子加权调度 score = 0.4·match + 0.3·(1−load) + 0.2·norm(priority) + 0.1·succ
  executor.py      沙箱执行 · 子进程超时终止
  verifier.py      五级判据 L1–L4
  loop.py          失败分类 → 修正策略 → 三终止条件
  tools.py         工具注册表（JSON Schema）
  kb.py            方法口径库（章节级引用）
  llm.py           模型接入（可降级）
  metrics.py       指标汇总
```

内核必须独立成进程的三个理由：

1. 它要执行**模型生成、未经验证**的代码，必须能超时、能终止、能丢弃；
2. 执行与验证要留下可逐行核对的日志，Web 进程崩了不能影响证据；
3. 内核不依赖任何第三方库，评委只需 `python`，不需要 `node_modules`。

---

## 目录

```
harness/          编排内核（12 个模块，纯标准库）
configs/          agents.json / workflow.json / policy.json / tools.json / kb/methods.md
cases/            10 条用例定义（含 2 条必失败）
evidence/         每个用例的日志合并包（浏览器可直接核对）
src/app/console/  编排控制台页面
src/app/api/orchestrate/route.ts   控制台 → 内核
src/app/          原有校园问答页面（作为平台可接入的外部场景）
src/lib/agents/plan-contract.ts    计划核验接口契约（TypeScript 侧）
docs/             分工、协作与接口说明
```

## 复现

```bash
python -m harness suite --mode all     # 重新生成 artifacts/ 与 suite_table.json
```
`evidence/` 下的文件名与分节标题和 `artifacts/` 一一对应，可以逐条比对。

## 自测与 CI

```bash
python -m unittest discover -s tests -p "test_*.py"     # 内核 19 条：调度 / 终止条件 / 故障注入 / 验证口径
node --experimental-strip-types --test --test-isolation=none tests/plan-verifier.test.mjs   # 核验器 27 条
```

`.github/workflows/ci.yml` 在 push / PR 时自动跑这两组测试并重跑三档基线。
逐条「要求 → 代码 → 命令 → 证据」的对照表见 [docs/评分对照表.md](docs/评分对照表.md)。

## 许可

仅用于赛事评审与学习交流；`configs/kb/methods.md` 中的口径引用自公开统计教材，数据为合成数据。
