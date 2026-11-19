# -*- coding: utf-8 -*-
"""调度器：四因子加权打分 + 决策日志 + 高负载改派 + 优先级抢占。
分数 = w1*能力匹配 + w2*(1-负载) + w3*优先级 + w4*历史成功率
"""
import json


class Agent:
    def __init__(self, spec):
        self.name = spec["name"]
        self.skills = set(spec.get("skills", []))
        self.tools = spec.get("tools", [])
        self.weight_cap = spec.get("capacity", 2)      # 同时可跑任务数
        self.running = 0
        self.done = 0
        self.ok = 0

    @property
    def load(self):
        return min(1.0, self.running / max(1, self.weight_cap))

    @property
    def success_rate(self):
        return 1.0 if self.done == 0 else self.ok / self.done

    def as_dict(self):
        return {"name": self.name, "skills": sorted(self.skills), "tools": self.tools,
                "running": self.running, "load": round(self.load, 3),
                "success_rate": round(self.success_rate, 3)}


class Scheduler:
    def __init__(self, agents, policy, store):
        self.agents = agents
        self.w = policy["weights"]
        self.min_match = policy.get("min_match", 0.34)
        self.high_load = policy.get("high_load", 0.5)
        self.store = store

    def match(self, need, agent):
        need = set(need)
        if not need:
            return 1.0
        return len(need & agent.skills) / len(need)

    def score(self, task, agent):
        m = self.match(task.get("skills", []), agent)
        import math
        p = task.get("priority", 3) / 5.0           # 1..5 归一
        s = (self.w["match"] * m
             + self.w["load"] * (1 - agent.load)
             + self.w["priority"] * p
             + self.w["success"] * agent.success_rate)
        return round(s, 4), {"match": round(m, 3), "load": round(agent.load, 3),
                             "priority": round(p, 3),
                             "success_rate": round(agent.success_rate, 3)}

    def dispatch(self, tid, task, role):
        cands = [a for a in self.agents
                 if a.name.startswith(role) and self.match(task.get("skills", []), a) >= self.min_match]
        if not cands:
            self.store.log(tid, "dispatch", task=task["id"], event="no_capable_agent", role=role)
            return None
        scored = sorted(((self.score(task, a), a) for a in cands), key=lambda x: -x[0][0])
        (best_score, detail), best = scored[0]
        event = "assign"
        if len(scored) > 1 and best.load >= self.high_load:
            (second_score, _), second = scored[1]
            self.store.log(tid, "dispatch", task=task["id"], event="rebind",
                           **{"from": best.name, "to": second.name,
                              "reason": "high_load",
                              "from_score": best_score, "to_score": second_score})
            best = second
            event = "assign_after_rebind"
        self.store.log(tid, "dispatch", task=task["id"], event=event, agent=best.name,
                       score=best_score, factors=detail, role=role)
        best.running += 1
        return best

    def release(self, agent, ok=True):
        if agent is None:
            return
        agent.running = max(0, agent.running - 1)
        agent.done += 1
        agent.ok += 1 if ok else 0

    def snapshot(self):
        return [a.as_dict() for a in self.agents]


def build_agents(path_cfg):
    return [Agent(s) for s in path_cfg]
