import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 编排内核的唯一入口。
 *
 * 为什么编排内核是独立的 Python 进程、而不是直接写在 Next.js 里：
 * 1) 内核要执行「模型生成、未经验证」的代码，必须进程隔离（可超时、可终止、可丢弃）；
 * 2) 执行/验证过程要留下可逐行核对的日志（dispatch.log / verify_r*.json），
 *    放在 Web 进程里做不到"崩了也不影响控制台"；
 * 3) 内核不依赖任何第三方库，评委只需 python，不需要 node_modules。
 *
 * 这个 route 只做三件事：调内核、收回 artifacts、结构化返回给控制台页面。
 */

const ALLOWED_CASES = [
  'T-01', 'T-02', 'T-03', 'T-04', 'T-05',
  'T-06', 'T-07', 'T-08', 'T-09', 'T-10',
];

interface ProcResult {
  code: number;
  stdout: string;
  stderr: string;
  spawnError: string | null;
}

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
  caseId: string;
  plan: PlanBundle | null;
  result: ResultBundle | null;
  dispatch: DispatchEvent[];
  exec: Record<string, unknown>[];
  verify: Record<string, unknown>[];
  verifyRounds: VerifyRound[];
  loop: LoopEvent[];
  report: string | null;
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
  note?: string;
  script_source?: string;
  llm_calls?: number;
  llm_tokens?: number;
}

type SuiteTable = Record<string, SuiteRow[]>;

function pythonBin(): string {
  const custom = process.env.PYTHON_BIN?.trim();
  return custom && custom.length > 0 ? custom : 'python';
}

function projectRoot(): string {
  return process.cwd();
}

function runProc(args: string[], timeoutMs: number): Promise<ProcResult> {
  const cwd = projectRoot();
  const bin = pythonBin();
  return new Promise<ProcResult>((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn(bin, args, { cwd, windowsHide: true });
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill();
      }
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr, spawnError: error.message });
    });
    child.on('close', (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr, spawnError: null });
    });
  });
}

function readText(file: string): string | null {
  if (!existsSync(file)) return null;
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function readJsonFile<T>(file: string): T | null {
  const raw = readText(file);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readJsonLines<T>(file: string): T[] {
  const raw = readText(file);
  if (!raw) return [];
  const rows: T[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    try {
      rows.push(JSON.parse(trimmed) as T);
    } catch {
      // 单行损坏不影响整体，跳过
    }
  }
  return rows;
}

function readCaseBundle(caseId: string): CaseBundle {
  const dir = path.join(projectRoot(), 'artifacts', caseId);
  const at = (name: string): string => path.join(dir, name);
  const rounds: VerifyRound[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const round = readJsonFile<VerifyRound>(at(`verify_r${i}.json`));
    if (round) rounds.push(round);
  }
  return {
    caseId,
    plan: readJsonFile<PlanBundle>(at('plan.json')),
    result: readJsonFile<ResultBundle>(at('result.json')),
    dispatch: readJsonLines<DispatchEvent>(at('dispatch.log')),
    exec: readJsonLines<Record<string, unknown>>(at('exec.log')),
    verify: readJsonLines<Record<string, unknown>>(at('verify.log')),
    verifyRounds: rounds,
    loop: readJsonLines<LoopEvent>(at('loop.log')),
    report: readText(at('report.md')),
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const mode = params.get('mode') === 'suite' ? 'suite' : 'case';
  const useLlm = params.get('llm') === '1';
  const requested = (params.get('case') ?? 'T-07').toUpperCase();
  const caseId = ALLOWED_CASES.includes(requested) ? requested : 'T-07';

  const started = Date.now();
  const args = mode === 'suite'
    ? ['-m', 'harness', 'suite', '--mode', 'all']
    : ['-m', 'harness', 'run', '--case', caseId];
  if (useLlm) args.push('--llm');

  const proc = await runProc(args, mode === 'suite' ? 180_000 : 60_000);

  if (proc.spawnError !== null) {
    return NextResponse.json(
      {
        ok: false,
        error: 'python_not_found',
        detail: proc.spawnError,
        hint: `找不到 python 可执行文件（当前尝试：${pythonBin()}）。请确认已安装 Python 3.10+ 并加入 PATH，或用环境变量 PYTHON_BIN 指定绝对路径。`,
        command: `${pythonBin()} ${args.join(' ')}`,
      },
      { status: 200 },
    );
  }

  const elapsed = Number(((Date.now() - started) / 1000).toFixed(3));
  const bundle = readCaseBundle(caseId);
  const suite = mode === 'suite'
    ? readJsonFile<SuiteTable>(path.join(projectRoot(), 'artifacts', 'suite_table.json'))
    : null;

  return NextResponse.json({
    ok: proc.code === 0,
    mode,
    caseId,
    llm: useLlm,
    exitCode: proc.code,
    elapsed_s: elapsed,
    command: `${pythonBin()} ${args.join(' ')}`,
    stdout: proc.stdout.slice(-4000),
    stderr: proc.stderr.slice(-4000),
    bundle,
    suite,
    generatedAt: new Date().toISOString(),
  });
}
