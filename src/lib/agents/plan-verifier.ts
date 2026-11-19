/**
 * 计划核验器（规则核验，纯函数）。
 *
 * 只做“输入内部一致性 + 证据标记”的检查：不调用模型、不访问网络、不读密钥、
 * 不生成随机数据、不依赖当前时间，也不修改传入对象。
 * 真实资料是否属实、步行时间是否合理，由后续资料核对环节负责。
 */
import type {
  PlanCandidate,
  PlanCheckCode,
  PlanEvidence,
  PlanIssue,
  PlanRequest,
  PlanStep,
  PlanVerification,
  RequestedTask,
  TimeWindow,
} from './plan-contract';

/** HH:mm -> 分钟数；非法返回 null（不抛异常，保证输出稳定）。 */
function parseTime(value: unknown): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const matched = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!matched) {
    return null;
  }
  return Number(matched[1]) * 60 + Number(matched[2]);
}

interface Span {
  start: number;
  end: number;
}

/** 解析一个时间窗；任一端点非法或区间不成立都返回 null。 */
function parseWindow(window: TimeWindow | undefined): Span | null {
  if (!window) {
    return null;
  }
  const start = parseTime(window.start);
  const end = parseTime(window.end);
  if (start === null || end === null || end <= start) {
    return null;
  }
  return { start, end };
}

function unique(list: string[]): string[] {
  return Array.from(new Set(list));
}

function issue(
  code: PlanCheckCode,
  severity: PlanIssue['severity'],
  stepIds: string[],
  message: string,
  suggestion: string,
): PlanIssue {
  return { code, severity, stepIds: unique(stepIds), message, suggestion };
}

/** 步骤的合法时间区间；undefined 表示时间缺失或非法（不参与后续比较）。 */
function stepSpan(step: PlanStep): Span | undefined {
  if (step.start === undefined || step.end === undefined) {
    return undefined;
  }
  const start = parseTime(step.start);
  const end = parseTime(step.end);
  if (start === null || end === null || end <= start) {
    return undefined;
  }
  return { start, end };
}

export function verifyPlan(request: PlanRequest, plan: PlanCandidate): PlanVerification {
  const issues: PlanIssue[] = [];

  const tasks: RequestedTask[] = Array.isArray(request?.tasks) ? [...request.tasks] : [];
  const steps: PlanStep[] = Array.isArray(plan?.steps) ? [...plan.steps] : [];
  const evidence: PlanEvidence[] = Array.isArray(request?.evidence) ? [...request.evidence] : [];

  // ---------- 1. missing_input：缺什么就说清补什么 ----------
  const lackCampus = !request?.campus;
  const lackWindow = !request?.availableWindow;
  const lackTasks = tasks.length === 0;
  const lackSteps = steps.length === 0;

  if (lackCampus) {
    issues.push(issue('missing_input', 'needs_info', [],
      '缺少选定校区：无法判断步骤是否跨校区。', '在 request.campus 中指定 haizhu 或 baiyun。'));
  }
  if (lackWindow) {
    issues.push(issue('missing_input', 'needs_info', [],
      '缺少用户可用时段：无法判断步骤是否落在用户可支配时间内。',
      '在 request.availableWindow 中提供同一天的 start / end（HH:mm）。'));
  }
  if (lackTasks) {
    issues.push(issue('missing_input', 'needs_info', [],
      '缺少原始任务清单：没有可核对的覆盖基准。', '在 request.tasks 中列出用户提出的原始任务及其 id。'));
  }
  if (lackSteps) {
    issues.push(issue('missing_input', 'needs_info', [],
      '计划没有任何步骤：无法核验。', '让计划生成环节输出至少一个步骤，或先补充用户约束。'));
  }

  const noTimeSteps = steps.filter((step) => step.start === undefined || step.end === undefined);
  if (noTimeSteps.length > 0) {
    issues.push(issue('missing_input', 'needs_info', noTimeSteps.map((step) => step.id),
      `有 ${noTimeSteps.length} 个步骤缺少起止时间，无法参与时间比较。`,
      '为每个步骤补齐 start / end（HH:mm），或说明该步骤为无需到场的准备事项。'));
  }

  // 任务清单或步骤缺失时，其余规则没有可比对的基准，直接返回。
  if (lackTasks || lackSteps) {
    return summarize(issues);
  }

  // ---------- 2. invalid_time：非法格式与倒置区间 ----------
  const badTimeSteps = steps.filter((step) => {
    if (step.start === undefined || step.end === undefined) {
      return false; // 已按 missing_input 报过
    }
    const start = parseTime(step.start);
    const end = parseTime(step.end);
    return start === null || end === null || end <= start;
  });
  if (badTimeSteps.length > 0) {
    issues.push(issue('invalid_time', 'error', badTimeSteps.map((step) => step.id),
      `有 ${badTimeSteps.length} 个步骤的时间非法：不是合法 HH:mm，或结束时间不晚于开始时间。`,
      '改成同一天内的 HH:mm，且 end 必须晚于 start；本版本不处理跨午夜与零点区间。'));
  }

  const spanById = new Map<string, Span>();
  for (const step of steps) {
    const span = badTimeSteps.includes(step) ? undefined : stepSpan(step);
    if (span) {
      spanById.set(step.id, span);
    }
  }

  const requestWindow = parseWindow(request.availableWindow);
  if (request.availableWindow && requestWindow === null) {
    issues.push(issue('invalid_time', 'error', [],
      '用户可用时段本身不是合法区间（格式错误或 end 不晚于 start）。',
      '把 availableWindow 改成合法的 HH:mm 区间后重新核验。'));
  }

  // ---------- 3. task_coverage：每个原始任务恰好一个步骤 ----------
  const taskIdCount = new Map<string, number>();
  for (const task of tasks) {
    taskIdCount.set(task.id, (taskIdCount.get(task.id) ?? 0) + 1);
  }
  const duplicatedTaskIds = [...taskIdCount.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  if (duplicatedTaskIds.length > 0) {
    issues.push(issue('task_coverage', 'error', [],
      `原始任务 id 重复：${duplicatedTaskIds.join('、')}。`,
      '每个原始任务保留唯一 id，重复项先合并或重新编号。'));
  }

  const knownTaskIds = new Set(tasks.map((task) => task.id));
  const stepCountByTask = new Map<string, string[]>();
  const unknownTaskSteps: PlanStep[] = [];
  for (const step of steps) {
    if (!knownTaskIds.has(step.taskId)) {
      unknownTaskSteps.push(step);
      continue;
    }
    const bucket = stepCountByTask.get(step.taskId) ?? [];
    bucket.push(step.id);
    stepCountByTask.set(step.taskId, bucket);
  }
  if (unknownTaskSteps.length > 0) {
    issues.push(issue('task_coverage', 'error', unknownTaskSteps.map((step) => step.id),
      `计划引用了原始任务清单里不存在的 taskId：${unique(unknownTaskSteps.map((step) => step.taskId)).join('、')}。`,
      '把 step.taskId 改成 request.tasks 中真实存在的 id，或先在原始任务里登记该任务。'));
  }

  const repeated = [...stepCountByTask.entries()].filter(([, ids]) => ids.length > 1);
  for (const [taskId, stepIds] of repeated) {
    issues.push(issue('task_coverage', 'error', stepIds,
      `同一原始任务被安排了 ${stepIds.length} 个步骤（taskId=${taskId}）。`,
      '第一版约定每个原始任务恰好对应一个步骤：合并重复步骤，或把拆分出的动作合并回原任务。'));
  }

  const uncovered = tasks.filter((task) => !stepCountByTask.has(task.id));
  if (uncovered.length > 0) {
    issues.push(issue('task_coverage', 'error', [],
      `有 ${uncovered.length} 个原始任务未被计划覆盖：${uncovered.map((task) => task.id).join('、')}。`,
      '为每个未覆盖任务补一个步骤，或在原始任务清单中删除确实不需要办理的任务。'));
  }

  // ---------- 4. outside_available_window：不能只看步骤之间 ----------
  if (requestWindow) {
    const outOfWindow = steps.filter((step) => {
      const span = spanById.get(step.id);
      return span !== undefined && (span.start < requestWindow.start || span.end > requestWindow.end);
    });
    if (outOfWindow.length > 0) {
      issues.push(issue('outside_available_window', 'error', outOfWindow.map((step) => step.id),
        `有 ${outOfWindow.length} 个步骤超出用户可用时段 ${request.availableWindow?.start}–${request.availableWindow?.end}。`,
        '把步骤挪进可用时段，或明确告知用户需要额外时间并取得确认。'));
    }
  }

  // ---------- 5. time_overlap：end 等于下一步 start 不算重叠 ----------
  const timedSteps = steps.filter((step) => spanById.has(step.id));
  for (let i = 0; i < timedSteps.length; i += 1) {
    for (let j = i + 1; j < timedSteps.length; j += 1) {
      const a = timedSteps[i];
      const b = timedSteps[j];
      const spanA = spanById.get(a.id);
      const spanB = spanById.get(b.id);
      if (!spanA || !spanB) {
        continue;
      }
      if (spanA.start < spanB.end && spanB.start < spanA.end) {
        issues.push(issue('time_overlap', 'error', [a.id, b.id],
          `步骤 ${a.id}（${a.start}–${a.end}）与 ${b.id}（${b.start}–${b.end}）时间重叠。`,
          '错开其中一个步骤；若两件事可并行，也应在计划里显式标注而不是让时间重叠。'));
      }
    }
  }

  // ---------- 6. campus_mismatch：本版本不做跨校区计划 ----------
  if (request.campus) {
    const wrongCampus = steps.filter((step) => step.campus !== request.campus);
    if (wrongCampus.length > 0) {
      issues.push(issue('campus_mismatch', 'error', wrongCampus.map((step) => step.id),
        `有 ${wrongCampus.length} 个步骤的校区与选定校区 ${request.campus} 不一致。`,
        '把步骤校区统一为选定校区；确实需要跨校区时，应拆成两段并补足通勤时间后再核验。'));
    }
  }

  // ---------- 7. dependency_conflict：重复 id、未知依赖、环、顺序 ----------
  const stepIdCount = new Map<string, number>();
  for (const step of steps) {
    stepIdCount.set(step.id, (stepIdCount.get(step.id) ?? 0) + 1);
  }
  const duplicatedStepIds = [...stepIdCount.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  if (duplicatedStepIds.length > 0) {
    issues.push(issue('dependency_conflict', 'error', duplicatedStepIds,
      `步骤 id 重复：${duplicatedStepIds.join('、')}，依赖关系无法唯一确定。`,
      '保证每个步骤 id 唯一；重复步骤应合并或重新编号。'));
  }

  const knownStepIds = new Set(steps.map((step) => step.id));
  const unknownDeps: string[] = [];
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!knownStepIds.has(dep)) {
        unknownDeps.push(step.id);
      }
    }
  }
  if (unknownDeps.length > 0) {
    issues.push(issue('dependency_conflict', 'error', unknownDeps,
      '有步骤依赖了不存在的步骤 id。',
      '把 dependsOn 指向计划中真实存在的步骤 id，或删除该依赖。'));
  }

  const cycleStepIds = findCycle(steps);
  if (cycleStepIds.length > 0) {
    issues.push(issue('dependency_conflict', 'error', cycleStepIds,
      `依赖关系存在环：${cycleStepIds.join(' → ')}，计划永远无法开始。`,
      '断开环上的至少一条依赖，让计划成为有向无环图。'));
  }

  const orderViolations: string[] = [];
  for (const step of steps) {
    const span = spanById.get(step.id);
    if (!span) {
      continue;
    }
    for (const dep of step.dependsOn ?? []) {
      const depSpan = spanById.get(dep);
      if (!depSpan) {
        continue;
      }
      if (depSpan.end > span.start) {
        orderViolations.push(step.id);
      }
    }
  }
  if (orderViolations.length > 0) {
    issues.push(issue('dependency_conflict', 'error', orderViolations,
      '有步骤的开始时间早于其依赖步骤的结束时间。',
      '把被依赖步骤排在前面，或让本步骤 start 不早于依赖步骤的 end。'));
  }

  // ---------- 8. outside_service_window：任务开放时段 ----------
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const outOfService: string[] = [];
  const unknownService: string[] = [];
  const invalidService: string[] = [];
  for (const step of steps) {
    const task = taskById.get(step.taskId);
    if (!task) {
      continue; // task_coverage 已报
    }
    if (!task.serviceWindow) {
      unknownService.push(step.id);
      continue;
    }
    const serviceSpan = parseWindow(task.serviceWindow);
    if (!serviceSpan) {
      invalidService.push(step.id);
      continue;
    }
    const span = spanById.get(step.id);
    if (!span) {
      continue;
    }
    if (span.start < serviceSpan.start || span.end > serviceSpan.end) {
      outOfService.push(step.id);
    }
  }
  if (invalidService.length > 0) {
    issues.push(issue('invalid_time', 'error', invalidService,
      '有任务的服务时段本身格式非法（格式错误或 end 不晚于 start）。',
      '把 task.serviceWindow 改成合法的 HH:mm 区间；规则核验器不会替你猜开放时间。'));
  }
  if (outOfService.length > 0) {
    issues.push(issue('outside_service_window', 'error', outOfService,
      '有步骤落在对应任务的开放时段之外。',
      '把步骤挪进开放时段；若资料显示开放时间有变，应先更新资料再重新核验。'));
  }
  if (unknownService.length > 0) {
    issues.push(issue('unknown_service_window', 'warning', unknownService,
      '有任务缺少开放时段，核验器不会替它编造时间。',
      '补上资料核对环节得到的开放时段；缺失时该步骤只能做“无开放时段”的降级核验。'));
  }

  // ---------- 9. missing_evidence / 10. unverified_evidence ----------
  const evidenceCount = new Map<string, number>();
  for (const item of evidence) {
    evidenceCount.set(item.id, (evidenceCount.get(item.id) ?? 0) + 1);
  }
  const duplicatedEvidenceIds = [...evidenceCount.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  if (duplicatedEvidenceIds.length > 0) {
    issues.push(issue('missing_evidence', 'needs_info', [],
      `资料 id 重复：${duplicatedEvidenceIds.join('、')}，无法确定引用的是哪一条。`,
      '资料清单里每条依据保留唯一 id。'));
  }

  const evidenceById = new Map<string, PlanEvidence>();
  for (const item of evidence) {
    if (!evidenceById.has(item.id)) {
      evidenceById.set(item.id, item);
    }
  }
  const noEvidenceSteps = steps.filter((step) => (step.evidenceIds ?? []).length === 0);
  if (noEvidenceSteps.length > 0) {
    issues.push(issue('missing_evidence', 'needs_info', noEvidenceSteps.map((step) => step.id),
      '有步骤没有给出任何依据。',
      '为每个步骤挂上支撑它的 evidence id；没有依据时应标为待补充，而不是凭空安排。'));
  }

  const unknownEvidenceSteps: string[] = [];
  const missingEvidenceByStep: string[] = [];
  for (const step of steps) {
    const ids = step.evidenceIds ?? [];
    const unknown = ids.filter((id) => !evidenceById.has(id));
    if (unknown.length > 0) {
      unknownEvidenceSteps.push(step.id);
    }
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        missingEvidenceByStep.push(step.id);
        break;
      }
      seen.add(id);
    }
  }
  if (unknownEvidenceSteps.length > 0) {
    issues.push(issue('missing_evidence', 'needs_info', unknownEvidenceSteps,
      '有步骤引用了资料清单里不存在的 evidence id。',
      '改成真实存在的 evidence id；若资料尚未登记，先补进 request.evidence。'));
  }
  if (missingEvidenceByStep.length > 0) {
    issues.push(issue('missing_evidence', 'needs_info', missingEvidenceByStep,
      '有步骤的 evidenceIds 内部重复引用同一条资料。',
      '去掉重复引用，保留一条即可。'));
  }

  const unverifiedSteps: string[] = [];
  const simulationSteps: string[] = [];
  for (const step of steps) {
    for (const id of step.evidenceIds ?? []) {
      const item = evidenceById.get(id);
      if (!item) {
        continue; // missing_evidence 已报
      }
      if (item.kind === 'simulation') {
        if (!request.simulation) {
          simulationSteps.push(step.id);
        }
        continue;
      }
      if (item.verified !== true) {
        unverifiedSteps.push(step.id);
      }
    }
  }
  if (unverifiedSteps.length > 0) {
    issues.push(issue('unverified_evidence', 'needs_info', unverifiedSteps,
      '有步骤引用了标记为“未核实”的 official / project 依据。',
      '先由资料核对环节把这些依据标为 verified=true，或改用已核实的依据。'));
  }
  if (simulationSteps.length > 0) {
    issues.push(issue('unverified_evidence', 'needs_info', simulationSteps,
      '真实计划（request.simulation=false）使用了模拟依据。',
      '换成官方或项目依据，或把整个计划明确标注为模拟演示（request.simulation=true）。'));
  }

  return summarize(issues);
}

/** 依赖环检测：返回环上的步骤 id（无环返回空数组），不会因自环或长链死循环。 */
function findCycle(steps: PlanStep[]): string[] {
  const adjacency = new Map<string, string[]>();
  for (const step of steps) {
    const deps = (step.dependsOn ?? []).filter((dep) => dep !== undefined);
    const existing = adjacency.get(step.id) ?? [];
    adjacency.set(step.id, [...existing, ...deps]);
  }

  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  let cycle: string[] = [];

  const visit = (node: string): boolean => {
    state.set(node, 1);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      if (!adjacency.has(next)) {
        continue; // 未知依赖已单独报错
      }
      const nextState = state.get(next) ?? 0;
      if (nextState === 1) {
        const from = stack.indexOf(next);
        cycle = [...stack.slice(from >= 0 ? from : 0), next];
        return true;
      }
      if (nextState === 0 && visit(next)) {
        return true;
      }
    }
    stack.pop();
    state.set(node, 2);
    return false;
  };

  for (const step of steps) {
    if ((state.get(step.id) ?? 0) === 0 && visit(step.id)) {
      return cycle;
    }
  }
  return [];
}

function summarize(issues: PlanIssue[]): PlanVerification {
  const hasError = issues.some((item) => item.severity === 'error');
  const hasNeedsInfo = issues.some((item) => item.severity === 'needs_info');
  const status: PlanVerification['status'] = hasError ? 'revise' : hasNeedsInfo ? 'needs_info' : 'passed';
  return { status, issues };
}
