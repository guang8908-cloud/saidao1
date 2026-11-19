/** 双方共用的接口；核验器由队员在 plan-verifier.ts 中实现。 */
export type Campus = 'haizhu' | 'baiyun';

/** 同一天内的当地时间，格式 HH:mm；本版本不处理跨午夜计划。 */
export interface TimeWindow {
  start: string;
  end: string;
}

export interface PlanEvidence {
  id: string;
  kind: 'official' | 'project' | 'simulation';
  source: string;
  summary: string;
  /** 由资料核对环节填写；规则核验器不自行访问来源。 */
  verified: boolean;
}

export interface PlanStep {
  id: string;
  /** 对应用户要求中的 RequestedTask.id。 */
  taskId: string;
  title: string;
  campus: Campus;
  start?: string;
  end?: string;
  dependsOn: string[];
  evidenceIds: string[];
}

export interface RequestedTask {
  id: string;
  title: string;
  /** 已知的办事开放时间；来自资料/工具环节，不能由计划自行放宽。 */
  serviceWindow?: TimeWindow;
}

/** 由调用方保留的用户要求与资料；和模型生成的计划分开传入。 */
export interface PlanRequest {
  campus?: Campus;
  availableWindow?: TimeWindow;
  /** true 表示明确标注为模拟演示，可使用 simulation 依据。 */
  simulation: boolean;
  tasks: RequestedTask[];
  evidence: PlanEvidence[];
}

export interface PlanCandidate {
  steps: PlanStep[];
}

export type PlanCheckCode =
  | 'missing_input'
  | 'task_coverage'
  | 'invalid_time'
  | 'outside_available_window'
  | 'time_overlap'
  | 'campus_mismatch'
  | 'dependency_conflict'
  | 'outside_service_window'
  | 'missing_evidence'
  | 'unverified_evidence'
  | 'unknown_service_window';

export interface PlanIssue {
  code: PlanCheckCode;
  severity: 'error' | 'needs_info' | 'warning';
  stepIds: string[];
  message: string;
  suggestion: string;
}

export interface PlanVerification {
  /** error 优先 -> revise；否则 needs_info -> needs_info；否则 passed。 */
  status: 'passed' | 'revise' | 'needs_info';
  issues: PlanIssue[];
}

/** 待实现：verifyPlan(request: PlanRequest, plan: PlanCandidate): PlanVerification */
