# -*- coding: utf-8 -*-
"""artifact 存储：每个 task 一个目录，日志一律 JSONL，可被评审逐条核对。"""
import json
import os
import time
from pathlib import Path


class Store:
    def __init__(self, root="artifacts"):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def task_dir(self, tid):
        d = self.root / tid
        (d / "scripts").mkdir(parents=True, exist_ok=True)
        return d

    def log(self, tid, channel, **fields):
        d = self.task_dir(tid)
        rec = {"ts": time.strftime("%Y-%m-%dT%H:%M:%S"), **fields}
        with open(d / f"{channel}.log", "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        return rec

    def write(self, tid, name, text):
        p = self.task_dir(tid) / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
        return str(p)

    def dump(self, tid, name, obj):
        return self.write(tid, name, json.dumps(obj, ensure_ascii=False, indent=2))

    def load(self, tid, name):
        p = self.task_dir(tid) / name
        if not p.exists():
            return None
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return None

    def exists(self, tid, name):
        return (self.task_dir(tid) / name).exists()


def load_config(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)
