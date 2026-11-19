'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DispatchEvent {
  ts?: string;
  task?: string;
  event?: string;
  agent?: string;
  role?: string;
  score?: number;
  reason?: string;
  factors?: Record<string, number>;
}

interface VerifyCheck {
  level?: string;
  name?: string;
  pass?: boolean;
  detail?: string;
}

interface VerifyRound {
  round?: number;
  passed?: boolean;
  fail_type?: string | null;
  evidence?: string;
  checks?: VerifyCheck[];
}

interface LoopEvent {
  ts?: string;
  round?: number;
  event?: string;
  fail_type?: string;
  strategy?: string;
  detail?: string;
  evidence?: string;
}

interface PlanBundle {
  goal?: string;
  steps?: string[];
  assumptions?: string[];
  kb_refs?: string[];
  source?: string;
  sample_n?: number;
}

interface ResultBundle {
  mean_a?: number;
  mean_b?: number;
  diff?: number;
  n_a?: number;
  n_b?: number;
  round?: number;
}

interface CaseBundle {
  caseId?: string;
  plan?: PlanBundle | null;
  result?: ResultBundle | null;
  dispatch?: DispatchEvent[];
  verifyRounds?: VerifyRound[];
  loop?: LoopEvent[];
  exec?: ExecEvent[];
  report?: string | null;
}

interface ExecEvent {
  event?: string;
  agent?: string;
  tool?: string;
  n_rows?: number;
  null_ratio?: number;
  in_rows?: number;
  out_rows?: number;
  round?: number;
  exit?: number;
  stdout?: string;
  source?: string;
  fault?: string;
}

/** 把一条 exec.log 记录压成一行，字段缺失就跳过，不编造。 */
function describeExec(item: ExecEvent): string {
  const parts: string[] = [];
  if (item.agent) parts.push(`agent=${item.agent}`);
  if (item.tool) parts.push(`tool=${item.tool}`);
  if (typeof item.n_rows === 'number') parts.push(`n_rows=${item.n_rows}`);
  if (typeof item.null_ratio === 'number') parts.push(`空值率=${(item.null_ratio * 100).toFixed(2)}%`);
  if (typeof item.in_rows === 'number' && typeof item.out_rows === 'number') {
    parts.push(`清洗 ${item.in_rows} → ${item.out_rows} 行（去空值/去重，丢弃 ${item.in_rows - item.out_rows} 行）`);
  }
  if (typeof item.round === 'number') parts.push(`round=${item.round}`);
  if (item.source) parts.push(`source=${item.source}`);
  if (item.fault) parts.push(`fault=${item.fault}`);
  if (typeof item.exit === 'number') parts.push(`exit=${item.exit}`);
  if (item.stdout) parts.push(item.stdout.trim());
  return parts.join(' · ');
}

interface SuiteRow {
  id?: string;
  name?: string;
  status?: string;
  rounds?: number;
  agent_calls?: number;
  duration_s?: number;
  fault?: string;
  fail_type?: string | null;
  strategy?: string | null;
  script_source?: string;
}

type SuiteTable = Record<string, SuiteRow[]>;

interface RunResponse {
  ok?: boolean;
  error?: string;
  detail?: string;
  hint?: string;
  command?: string;
  caseId?: string;
  mode?: string;
  exitCode?: number;
  elapsed_s?: number;
  stdout?: string;
  stderr?: string;
  bundle?: CaseBundle;
  suite?: SuiteTable | null;
  generatedAt?: string;
}

const CASES = ['T-01', 'T-02', 'T-03', 'T-04', 'T-05', 'T-06', 'T-07', 'T-08', 'T-09', 'T-10'];

const STATUS_STYLE: Record<string, string> = {
  passed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed: 'bg-rose-100 text-rose-800 border-rose-200',
  blocked: 'bg-amber-100 text-amber-900 border-amber-200',
  degraded: 'bg-sky-100 text-sky-900 border-sky-200',
};

function num(value: number | undefined, digits = 3): string {
  if (value === undefined || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

const MODES: Array<{ key: string; label: string }> = [
  { key: 'single', label: '单 Agent 直连' },
  { key: 'chain', label: '串行流水线（无调度/验证）' },
  { key: 'full', label: '本平台（调度+验证+自循环）' },
];

interface ModeSummary {
  total: number;
  passed: number;
  delivered: number;
  p50: number | null;
  p95: number | null;
  rounds: number | null;
  calls: number;
}

function pick(sorted: number[], ratio: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(ratio * sorted.length) - 1));
  return sorted[index];
}

/** 只做统计，不加工：数字全部来自 artifacts/suite_table.json 的逐条记录。 */
function summarize(rows: SuiteRow[] | undefined): ModeSummary {
  const list = rows ?? [];
  const durations = list
    .map((row) => row.duration_s)
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b);
  const rounds = list.map((row) => row.rounds).filter((value): value is number => typeof value === 'number');
  return {
    total: list.length,
    passed: list.filter((row) => statusOf(row) === 'passed').length,
    delivered: list.filter((row) => statusOf(row) === 'passed' || statusOf(row) === 'degraded').length,
    p50: pick(durations, 0.5),
    p95: pick(durations, 0.95),
    rounds: rounds.length > 0 ? rounds.reduce((sum, value) => sum + value, 0) / rounds.length : null,
    calls: list.reduce((sum, row) => sum + (row.agent_calls ?? 0), 0),
  };
}

function ratioText(part: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((part / total) * 100)}%（${part}/${total}）`;
}

function statusOf(row: SuiteRow): string {
  return (row.status ?? 'unknown').toLowerCase();
}

export default function ConsolePage() {
  const [caseId, setCaseId] = useState('T-07');
  const [llm, setLlm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RunResponse | null>(null);

  const run = useCallback(async (target: string, mode: 'case' | 'suite', useLlm: boolean) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ case: target, mode });
      if (useLlm) query.set('llm', '1');
      const res = await fetch(`/api/orchestrate?${query.toString()}`, { cache: 'no-store' });
      const json = (await res.json()) as RunResponse;
      setData(json);
    } catch (error) {
      const message = error instanceof Error ? error.message : '请求失败';
      setData({ ok: false, error: 'fetch_failed', detail: message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run('T-07', 'case', false);
  }, [run]);

  const bundle = data?.bundle ?? null;
  const plan = bundle?.plan ?? null;
  const result = bundle?.result ?? null;
  const dispatch = bundle?.dispatch ?? [];
  const verifyRounds = bundle?.verifyRounds ?? [];
  const loops = bundle?.loop ?? [];
  const exec = bundle?.exec ?? [];
  const suite = data?.suite ?? null;
  const rebinds = dispatch.filter((item) => item.reason === 'high_load');

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">VeriFlow 编排控制台</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">多智能体编排 · 调度 · 验证 · 自循环</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          所有数字来自编排内核写入 <code className="rounded bg-muted px-1">artifacts/</code> 的日志，页面只做展示，不做二次加工。
          换一台机器跑，数字应该一致；不一致就是内核行为变了，属于缺陷。
        </p>
      </header>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">选择用例并运行</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {CASES.map((item) => (
              <Button
                key={item}
                size="sm"
                variant={item === caseId ? 'default' : 'outline'}
                onClick={() => {
                  setCaseId(item);
                  void run(item, 'case', llm);
                }}
              >
                {item}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={loading} onClick={() => void run(caseId, 'case', llm)}>
              {loading ? '运行中…' : `运行 ${caseId}`}
            </Button>
            <Button variant="secondary" disabled={loading} onClick={() => void run(caseId, 'suite', llm)}>
              跑三档基线（10 条用例）
            </Button>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={llm}
                onChange={(event) => setLlm(event.target.checked)}
                className="h-4 w-4"
              />
              接真实大模型（--llm）
            </label>
            {data?.elapsed_s !== undefined ? (
              <Badge variant="outline">耗时 {data.elapsed_s}s</Badge>
            ) : null}
            {data?.command ? (
              <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{data.command}</code>
            ) : null}
          </div>
          {data?.error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <p className="font-medium">{data.error}</p>
              <p className="mt-1">{data.hint ?? data.detail}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              计划与知识库引用
              {plan?.source ? <Badge variant="outline" className="ml-2">{plan.source}</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">目标：</span>{plan?.goal ?? '—'}</p>
            <div>
              <p className="text-muted-foreground">步骤：</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {(plan?.steps ?? []).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div>
              <p className="text-muted-foreground">口径引用：</p>
              <ul className="mt-1 space-y-1">
                {(plan?.kb_refs ?? []).map((ref) => (
                  <li key={ref}>
                    <code className="rounded bg-muted px-1 text-xs">{ref}</code>
                  </li>
                ))}
              </ul>
            </div>
            <p>
              <span className="text-muted-foreground">样本量：</span>
              {plan?.sample_n ?? '—'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              调度时间线
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {dispatch.length} 条决策，其中 {rebinds.length} 次负载改派
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="text-muted-foreground">
                    <th className="py-1 pr-2">节点</th>
                    <th className="py-1 pr-2">Agent</th>
                    <th className="py-1 pr-2">score</th>
                    <th className="py-1 pr-2">match</th>
                    <th className="py-1 pr-2">load</th>
                    <th className="py-1 pr-2">priority</th>
                    <th className="py-1 pr-2">succ</th>
                    <th className="py-1">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatch.map((item, index) => (
                    <tr key={`${item.task ?? 'x'}-${index}`} className="border-t border-border/60">
                      <td className="py-1 pr-2 font-medium">{item.task ?? '—'}</td>
                      <td className="py-1 pr-2">{item.agent ?? '—'}</td>
                      <td className="py-1 pr-2">{num(item.score, 2)}</td>
                      <td className="py-1 pr-2">{num(item.factors?.match, 2)}</td>
                      <td className="py-1 pr-2">{num(item.factors?.load, 2)}</td>
                      <td className="py-1 pr-2">{num(item.factors?.priority, 2)}</td>
                      <td className="py-1 pr-2">{num(item.factors?.success_rate, 2)}</td>
                      <td className="py-1">
                        {item.reason === 'high_load' ? (
                          <Badge className="border-amber-200 bg-amber-100 text-amber-900">负载改派</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              执行与清洗事件
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {exec.length} 条，来自 artifacts/&lt;用例&gt;/exec.log
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 font-mono text-xs">
              {exec.map((item, index) => (
                <li key={index} className="flex flex-wrap items-baseline gap-x-2 border-b border-border/40 pb-1 last:border-0">
                  <span className={item.event === 'clean' ? 'text-emerald-700' : 'text-muted-foreground'}>
                    {item.event ?? 'event'}
                  </span>
                  <span>{describeExec(item)}</span>
                </li>
              ))}
              {exec.length === 0 ? <li className="text-muted-foreground">本条用例没有执行记录</li> : null}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              五级验证判据
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                共 {verifyRounds.length} 轮
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {verifyRounds.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有验证记录，先跑一个用例。</p>
            ) : null}
            {verifyRounds.map((round) => (
              <div key={round.round ?? 0} className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="font-medium">第 {round.round ?? '?'} 轮</span>
                  <Badge variant={round.passed ? 'default' : 'destructive'}>
                    {round.passed ? '通过' : `未通过 · ${round.fail_type ?? 'unknown'}`}
                  </Badge>
                </div>
                <ul className="space-y-1 text-xs">
                  {(round.checks ?? []).map((check) => (
                    <li key={`${round.round}-${check.level}`} className="flex gap-2">
                      <span className={check.pass ? 'text-emerald-600' : 'text-rose-600'}>
                        {check.pass ? '✓' : '✗'}
                      </span>
                      <span className="w-8 shrink-0 font-medium">{check.level}</span>
                      <span className="text-muted-foreground">{check.detail}</span>
                    </li>
                  ))}
                </ul>
                {round.evidence ? (
                  <p className="mt-2 text-xs text-muted-foreground">证据：{round.evidence}</p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              自循环事件
              <span className="ml-2 text-xs font-normal text-muted-foreground">{loops.length} 条</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {loops.length === 0 ? <p className="text-muted-foreground">本次没有触发修正循环。</p> : null}
            {loops.map((item, index) => (
              <div key={`${item.event ?? 'e'}-${index}`} className="flex flex-wrap items-center gap-2 rounded border p-2">
                <Badge variant="outline">R{item.round ?? '?'}</Badge>
                <span className="font-medium">{item.event}</span>
                {item.fail_type ? <span className="text-muted-foreground">失败类型 {item.fail_type}</span> : null}
                {item.strategy ? <span className="text-muted-foreground">策略 {item.strategy}</span> : null}
                {item.detail ? <span className="w-full text-muted-foreground">{item.detail}</span> : null}
                {item.evidence ? <span className="w-full text-muted-foreground">{item.evidence}</span> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">结果</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
              <div>
                <p className="text-muted-foreground">mean_a</p>
                <p className="text-lg font-semibold">{num(result?.mean_a, 4)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">mean_b</p>
                <p className="text-lg font-semibold">{num(result?.mean_b, 4)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">diff</p>
                <p className="text-lg font-semibold">{num(result?.diff, 4)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">n_a / n_b</p>
                <p className="text-lg font-semibold">
                  {result?.n_a ?? '—'} / {result?.n_b ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">收敛轮次</p>
                <p className="text-lg font-semibold">{result?.round ?? '—'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {suite ? (
          <>
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">三档基线对比（同一批 10 条用例）</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-2 pr-3">方案</th>
                    <th className="py-2 pr-3">全自动通过</th>
                    <th className="py-2 pr-3">交付成功</th>
                    <th className="py-2 pr-3">P50</th>
                    <th className="py-2 pr-3">P95</th>
                    <th className="py-2 pr-3">平均轮次</th>
                    <th className="py-2 pr-3">Agent 调用</th>
                  </tr>
                </thead>
                <tbody>
                  {MODES.map((mode) => {
                    const summary = summarize(suite[mode.key]);
                    return (
                      <tr key={mode.key} className="border-t border-border/60">
                        <td className="py-2 pr-3 font-medium">{mode.label}</td>
                        <td className="py-2 pr-3">{ratioText(summary.passed, summary.total)}</td>
                        <td className="py-2 pr-3">{ratioText(summary.delivered, summary.total)}</td>
                        <td className="py-2 pr-3">{summary.p50 === null ? '—' : `${num(summary.p50)}s`}</td>
                        <td className="py-2 pr-3">{summary.p95 === null ? '—' : `${num(summary.p95)}s`}</td>
                        <td className="py-2 pr-3">{summary.rounds === null ? '—' : num(summary.rounds, 2)}</td>
                        <td className="py-2 pr-3">{summary.calls}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-muted-foreground">
                「交付成功」= 全自动通过 + 降级交付（T-08 转人工后仍给出带假设的结果）；「平均轮次」只统计 self-loop 实际轮数。
                并发上限：单 Agent 1 / 串行 1 / 本平台 3（T-02 三路并行）。所有数字由 <code className="rounded bg-muted px-1">artifacts/suite_table.json</code> 现场统计。
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">逐条结果（同一批 10 条用例）</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-2 pr-3">用例</th>
                    <th className="py-2 pr-3">名称</th>
                    {Object.keys(suite).map((mode) => (
                      <th key={mode} className="py-2 pr-3">{mode}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(suite.full ?? suite.single ?? []).map((row, index) => (
                    <tr key={row.id ?? index} className="border-t border-border/60">
                      <td className="py-2 pr-3 font-medium">{row.id ?? '—'}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{row.name ?? '—'}</td>
                      {Object.keys(suite).map((mode) => {
                        const target = (suite[mode] ?? []).find((item) => item.id === row.id);
                        const status = target ? statusOf(target) : '';
                        return (
                          <td key={`${mode}-${row.id ?? index}`} className="py-2 pr-3">
                            <span className={`rounded border px-2 py-0.5 text-xs ${STATUS_STYLE[status] ?? 'bg-muted'}`}>
                              {status || '—'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          </>
        ) : null}

        {bundle?.report ? (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Writer Agent 生成的报告</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                {bundle.report}
              </pre>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <footer className="mt-8 text-xs text-muted-foreground">
        {data?.generatedAt ? <span>生成于 {data.generatedAt} · </span> : null}
        <span>失败即证据：T-08 转人工、T-09 达上限放弃、T-10 策略去重判死，都是设计出来的行为，不是没跑通。</span>
      </footer>
    </main>
  );
}
