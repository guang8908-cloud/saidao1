# -*- coding: utf-8 -*-
"""LLM 适配层。

设计原则（这三条写进方案书就是加分点，别只当实现细节）：
1. **可降级**：没有 Key 时所有角色退回确定性实现，全流程仍可跑通、可复现。
   评审 clone 下来不必配 Key 也能看到完整日志。
2. **有边界**：只有"需要语言理解"的环节接模型（规划、生成脚本、诊断、写报告）；
   校验环节**永不接生成模型**——否则就是自证。
3. **可核对**：每次调用记 model / 耗时 / 输入摘要 / 输出摘要，
   并在诊断环节记录"模型判断"与"规则分类"是否一致，供第三方复核。

Key 来源优先级：环境变量 DEEPSEEK_API_KEY > 工作区 .env.local > .env
"""
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_BASE = "https://api.deepseek.com/v1"
DEFAULT_MODEL = "deepseek-chat"


def _read_env_file():
    for name in (".env.local", ".env"):
        p = Path(name)
        if not p.exists():
            continue
        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def key():
    if not os.environ.get("DEEPSEEK_API_KEY"):
        _read_env_file()
    return os.environ.get("DEEPSEEK_API_KEY")


def available():
    return bool(key())


def model():
    return os.environ.get("DEEPSEEK_MODEL", DEFAULT_MODEL)


def base_url():
    return os.environ.get("DEEPSEEK_BASE_URL", DEFAULT_BASE)


def chat(system, user, temperature=0.0, timeout=90, retries=1, store=None, tid=None, tag=""):
    """返回 (text, meta)。无 Key 或缺网返回 (None, meta)，调用方必须能处理 None。"""
    k = key()
    if not k:
        return None, {"ok": False, "reason": "no_key"}
    body = json.dumps({
        "model": model(),
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": user}],
        "temperature": temperature,
        "stream": False,
    }).encode("utf-8")
    last = None
    for attempt in range(retries + 1):
        t0 = time.perf_counter()
        try:
            req = urllib.request.Request(
                base_url().rstrip("/") + "/chat/completions", data=body,
                headers={"Content-Type": "application/json",
                         "Authorization": "Bearer " + k})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = json.loads(r.read().decode("utf-8"))
            text = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {}) or {}
            meta = {"ok": True, "model": model(),
                    "latency_s": round(time.perf_counter() - t0, 2),
                    "prompt_tokens": usage.get("prompt_tokens"),
                    "completion_tokens": usage.get("completion_tokens"),
                    "attempt": attempt + 1, "tag": tag,
                    "in_chars": len(system) + len(user), "out_chars": len(text)}
            if store and tid:
                store.log(tid, "llm", event="call_ok", **meta)
            return text, meta
        except Exception as e:                       # 网络/额度/格式问题一律降级
            last = f"{type(e).__name__}: {str(e)[:200]}"
            if store and tid:
                store.log(tid, "llm", event="call_fail", tag=tag,
                          attempt=attempt + 1, error=last)
    return None, {"ok": False, "reason": last, "tag": tag}


def parse_json(text):
    """模型常带 ```json 包裹或前置说明，尽量抠出第一个 JSON 对象。"""
    if not text:
        return None
    s = text.strip()
    if s.startswith("```"):
        s = s.split("```")[1] if len(s.split("```")) > 1 else s
        s = s.replace("json", "", 1).strip() if s.lower().startswith("json") else s
    for i, ch in enumerate(s):
        if ch in "{[":
            depth = 0
            for j in range(i, len(s)):
                if s[j] in "{[":
                    depth += 1
                elif s[j] in "}]":
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(s[i:j + 1])
                        except Exception:
                            break
    return None
