# Agent 编排调度平台 · 最小可跑骨架

> 纯 Python 标准库，**无任何第三方依赖**。`clone` 下来三条命令就能看到完整日志与指标——
> 这是为了过"必须提供可复现 Demo"这一关，而不是为了炫技。

## 一、三条命令

```bash
python -m harness run  --case T-07          # 跑一条"依赖缺失"的用例，看它自己修好
python -m harness suite                     # 跑 10 条用例 × 三档基线对比
python -m harness show --case T-07          # 看这条的全部日志与判据
```

Windows 下直接双击 `run.cmd`（等价于上面前两条）。

跑完所有产物落在 `artifacts/<用例号>/`：

| 文件 | 内容 |
|---|---|
| `dispatch.log` | 每次派活：候选人、四个因子得分、是否改派、为什么 |
| `exec.log` | 探查/清洗/生成脚本/沙箱执行的逐次结果 |
| `verify.log` + `verify_r*.json` | 每轮 L1–L4 判据、失败类型、证据 |
| `loop.log` | 诊断→策略→修复动作，以及三条终止条件的命中记录 |
| `report.md` | 人读的汇总 |
| `scripts/analyze_r*.py` | 实际执行的脚本（可以自己拿去复跑） |

## 二、五个模块分别在哪

| 赛题要求 | 文件 | 说明 |
|---|---|---|
| Agent 团队定义 | `configs/agents.json` | 角色、技能、工具白名单、容量、记忆策略。改这个文件就改 Agent 团队 |
| 工作流编排 | `configs/workflow.json` | 节点 + 依赖 + `when` 条件分支 + `loop` 回边。改 `next` 就改流程走向 |
| 智能调度 | `harness/scheduler.py` | `score = 0.4·匹配 + 0.3·(1−负载) + 0.2·优先级 + 0.1·历史成功率` |
| 执行 | `harness/executor.py` | 生成脚本 → 独立子进程执行 → 读产物 |
| 验证 | `harness/verifier.py` | L1 结构 / L2 可执行 / L3 基准真值 / L4 交叉独立复算 |
| 自我循环 | `harness/loop.py` | 失败分类 → 策略映射 → 修复重跑；三条终止条件 |
| 指标 | `harness/metrics.py` | 成功率、轮次、P50/P95、Agent 调用次数 |

**注意验证节点不接生成模型**：L3 比的是"已知基准真值"，L4 比的是"另一条独立实现"，
两者都不问模型"你觉得对不对"——否则就是自证。

## 三、三档基线怎么来的

| 档位 | 做法 | 结果 |
|---|---|---|
| single | 一个 Agent 一次直连，无调度、无验证、无循环 | 5/10 |
| chain | 固定串行流水线，多人分工但没有智能调度与验证 | 5/10 |
| full | 本平台：调度 + 五级验证 + 自循环 | 9/10（接真模型；含 1 条转人工、1 条按终止条件主动放弃），降级模式下为 8/10 |

三档用同一批用例、同一把尺子（结果与基准真值的偏差 ≤ 0.5）判定成败。

`full` 不是 10/10，这是**故意**的：T-08 是需求歧义（该转人工而不是硬猜），
T-09 验证轮次上限=1 时数据本身有错（该放弃而不是无限重试），
T-10 备用实现同样不可用（策略去重后判死）。能收敛、也能认输，才算有终止条件。

## 四、接大模型（可选，但接了要重跑指标）

平台里 LLM 只负责**四个"需要说人话"的位置**，判定与调度一律不交给模型：

| 环节 | 谁做 | 失败时 |
|---|---|---|
| 任务规划 N1 | Planner Agent 出 `plan.json`（goal/assumptions/steps） | 回退规则模板 |
| 生成分析脚本 N5 | Executor Agent 出标准库 Python | 静态检查拦第三方 import → 回退已验证模板 |
| 故障诊断 N8 | 与规则诊断**并列**，日志记 `agree` | 只作旁证，不改变判定 |
| 报告叙述 N9 | Writer Agent 写结论摘要 | 回退模板 |

三条原则：**可降级**（没 Key 或接口挂了，全流程照跑）、**有边界**（模型碰不到 pass/fail 与派活打分）、
**可核对**（每次调用写 `llm.log`：model/latency/tokens/tag；模型产出的脚本落盘成 `scripts/analyze_r*.py`，评委能逐行看）。

配置 Key（二选一，不要提交到仓库）：

```powershell
# 方式一：写进工作区根目录的 .env.local（已在 .gitignore 里）
DEEPSEEK_API_KEY=sk-你的key

# 方式二：当前会话临时设环境变量
$env:DEEPSEEK_API_KEY="sk-你的key"
```

跑起来：

```powershell
python check_llm.py                      # 先验证 Key 通不通（打印耗时与 tokens）
python -m harness run  --case T-07 --llm # 单条，看 llm.log 与 scripts/analyze_r1.py 的来源
python -m harness suite --llm            # 全部 10 条 × 三档，重出指标
python gen_dashboard.py                  # 重新生成看板 dashboard.html
```

没有 Key 时 `--llm` 会自动降级并在日志里说明，**不会假装调用过模型**。

## 五、这套骨架的边界（写进方案书里，别让评委自己发现）

1. 不接 `--llm` 时，Agent 的"推理"是确定性规则实现，目的是让机制可复现、可离线跑；
   所有调度打分、五级判定、终止条件在任何模式下都由代码与配置决定，不由模型决定。
2. 调度是单进程内存态，"并发"是子进程并发派发，不是分布式压力测试。
   真实并发数请用你自己的压测工具给数。
3. 数据是合成数据（已知真值 2.5），真实场景请替换 `harness/dataset.py`。
4. 接真模型后**所有指标必须重跑**，不能沿用规则模式的数字。

## 六、改一处配置验证"不是硬编码"

把 `configs/policy.json` 的 `max_rounds` 改成 `1`，再跑 T-05：
它会从"修好后通过"变成"第一轮就放弃"。行为跟着配置走，这就是不做硬编码的证据。
