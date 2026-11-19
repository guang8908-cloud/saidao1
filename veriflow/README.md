# 溯真 VeriFlow — 多智能体编排与可信验证平台

面向科研数据分析场景的多智能体（Multi-Agent）编排、调度、执行与验证平台，参加第五届"未来杯"创新大赛**赛题一（Agent 编排创新应用）**。

参赛队伍：把爱留在811

---

## 一、一句话说清它做什么

一条科研数据分析任务进来，平台把它拆成 DAG，派给 4 个角色不同、工具不同、记忆不同的 Agent（规划者 / 执行者 / 校验者 / 撰写者）；执行完**必须过五级验证**，验证不通过就进入"执行 → 验证 → 诊断 → 修正 → 再执行"的自循环，直到通过，或触发三个终止条件之一。

平台不自己说了算：L3 比的是**基准真值**，L4 比的是**另一条独立实现**，两者都不是"再问一遍模型"。

## 二、快速开始（Python 3.9+，无需安装任何第三方包）

```bat
python -m harness run --case T-07          :: 单用例：失败 → 修正 → 通过
python -m harness suite --mode all         :: 三档基线对比：单 Agent / 串行 / 本平台
python -m harness metrics                  :: 指标汇总
python -m harness show --case T-05         :: 查看某用例完整日志
python -m harness tools                    :: 打印工具注册表（JSON Schema）
python -m harness kb --query "空值 单位"    :: 检索方法口径知识库
python gen_dashboard.py                    :: 生成 dashboard.html，双击打开看板
```

沙箱里执行的脚本只允许标准库，保证评委机器上也能原样跑通。

## 三、目录

```
configs/    agents.json / workflow.json / policy.json / tools.json / kb/methods.md
harness/    orchestrator / scheduler / executor / verifier / loop / tools / kb / llm / metrics / store
cases/      10 条用例（含 3 条故意设计为失败 / 放弃 / 卡死）
evidence/   每个用例一次完整运行的日志汇总 + 三档基线结果 suite_table.json
docs/       方案书、讲解 PPT、指标与用例表
dashboard.html  单文件看板（数据内联，无需服务器）
```

## 四、实测结果（evidence/suite_table.json）

| 方案 | 通过 | 说明 |
|---|---|---|
| 单 Agent 直连 | 5/10 | 无拆分、无验证 |
| 串行流水线 | 5/10 | 有角色分工，无调度、无验证 |
| **本平台** | **8/10** | 四因子调度 + 五级验证 + 自循环 |

8/10 不是缺陷，是设计：T-08 转人工、T-09 达到轮次上限主动放弃、T-10 策略去重判死。**能收敛，也能认输**，这是平台可信度的一部分。平均收敛轮次 1.40，P50 端到端 0.188 s（单机 8 核，子进程并发）。

## 五、接入大模型（可选，默认不依赖）

平台默认使用确定性规则实现，保证无网络、无密钥也能复现。配置 DeepSeek Key 后可加 `--llm`，让 LLM 承担规划 / 生成脚本 / 失败诊断 / 报告叙述四个环节：

```bat
:: 仓库根目录建 .env.local，写一行
DEEPSEEK_API_KEY=sk-xxxx

python -m harness run --case T-07 --llm
python -m harness suite --mode all --llm
```

三条边界：

- **可降级**：没有 Key 时自动回退规则实现，不报错、不阻塞。
- **有边界**：LLM 不参与打分与判定，只做生成与叙述；生成的脚本若引用了第三方包，会被静态检查拦下并回退到已验证模板。
- **可核对**：每次调用写入 `artifacts/<用例>/llm.log`（含耗时与 token 数），报告末尾声明数字来源。

接真实模型后所有指标必须重跑，本仓库不承诺"接上一定更好"。

## 六、复现说明

- 每个用例的原始链路：`dispatch.log`（调度决策与改派）、`exec.log`（执行与退出码）、`verify_r*.json`（五级判据）、`loop.log`（自循环）、`result.json`、`report.md`。`evidence/<用例>.md` 是它们的顺序汇总，跑一遍 `suite` 即可在本地重新生成原始文件。
- 验证阈值写在 `configs/policy.json`，口径写在 `configs/kb/methods.md`；验证证据里会回填命中的小节（`口径来源=configs/kb/methods.md#…`），评审可直接翻文件核对。
- 并发是子进程并发而非线程池，因此 P95 受本机核数影响，换机器数字会变，测量方法见 `harness/metrics.py`。

## 七、许可

仅用于本届大赛评审。第三方依赖：无（纯标准库）。
