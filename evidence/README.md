# evidence

这里是把 `artifacts/` 下每个用例的日志按固定顺序拼接后的只读副本，目的是让仓库体积可控、评审可以直接在浏览器里逐条核对。

- 本轮数据对应「接真实模型」口径：DeepSeek 官方端点，10 条用例 37 次调用、18151 tokens，交付 9/10、平均收敛 1.30 轮、P95 13.74 s。
- `T-01.md` … `T-10.md`：每个用例的计划、调度、执行、验证、循环、结果与报告。
- `suite_table.json`：三档基线（single / chain / full）的逐条对比。

重新生成真实日志（不需要任何第三方依赖）：

```bash
python -m harness suite --mode all        # 规则实现（无需 Key，数字会变）
python -m harness suite --mode all --llm  # 接真模型（需在 .env.local 配 LLM_API_KEY）
```

文件名与分节标题一一对应，`verify_r1.json` / `verify_r2.json` 就是自循环两轮的验证证据。
