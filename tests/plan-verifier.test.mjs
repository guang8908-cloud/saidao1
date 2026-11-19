/**
 * 计划核验器测试：node --experimental-strip-types --test tests/plan-verifier.test.mjs
 * 全部时间与依据均为自设模拟数据，不代表校园真实办公安排。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyPlan } from '../src/lib/agents/plan-verifier.ts';

function baseRequest(overrides = {}) {
  return {
    campus: 'baiyun',
    availableWindow: { start: '09:00', end: '11:00' },
    simulation: true,
    tasks: [
      { id: 'check-in', title: '学院登记', serviceWindow: { start: '09:00', end: '11:00' } },
      { id: 'dorm', title: '办理入住', serviceWindow: { start: '09:00', end: '12:00' } },
    ],
    evidence: [
      { id: 'fixture-1', kind: 'simulation', source: '本测试自设场景', summary: '相邻时段与依赖', verified: false },
    ],
    ...overrides,
  };
}

function step(overrides = {}) {
  return {
    id: 'step-1',
    taskId: 'check-in',
    title: '学院登记',
    campus: 'baiyun',
    start: '09:00',
    end: '09:30',
    dependsOn: [],
    evidenceIds: ['fixture-1'],
    ...overrides,
  };
}

function basePlan() {
  return {
    steps: [
      step({ id: 'step-1', taskId: 'check-in', start: '09:00', end: '09:30' }),
      step({ id: 'step-2', taskId: 'dorm', title: '办理入住', start: '09:30', end: '10:00', dependsOn: ['step-1'] }),
    ],
  };
}

function codes(result) {
  return result.issues.map((item) => item.code);
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.getOwnPropertyNames(value).forEach((key) => deepFreeze(value[key]));
    Object.freeze(value);
  }
  return value;
}

test('合法计划通过，且不产生任何问题', () => {
  const result = verifyPlan(baseRequest(), basePlan());
  assert.equal(result.status, 'passed');
  assert.deepEqual(result.issues, []);
});

test('相邻但不重叠（end 等于下一步 start）通过', () => {
  const plan = basePlan();
  plan.steps[1].start = '09:30';
  plan.steps[1].end = '10:00';
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'passed');
  assert.deepEqual(result.issues, []);
});

test('包含型时间重叠被判为 time_overlap', () => {
  const plan = basePlan();
  plan.steps[0].end = '10:00';
  plan.steps[1].start = '09:30';
  plan.steps[1].end = '09:45';
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('time_overlap'));
});

test('步骤超出用户可用时段被判为 outside_available_window', () => {
  const plan = basePlan();
  plan.steps[1].end = '11:30'; // 用户只到 11:00
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('outside_available_window'));
});

test('步骤校区与选定校区不一致被判为 campus_mismatch', () => {
  const plan = basePlan();
  plan.steps[1].campus = 'haizhu';
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('campus_mismatch'));
});

test('缺少校区返回 needs_info 并指出要补什么', () => {
  const request = baseRequest();
  delete request.campus;
  const result = verifyPlan(request, basePlan());
  assert.equal(result.status, 'needs_info');
  const target = result.issues.find((item) => item.code === 'missing_input');
  assert.ok(target);
  assert.match(target.message, /校区/);
});

test('缺少可用时段返回 needs_info', () => {
  const request = baseRequest();
  delete request.availableWindow;
  const result = verifyPlan(request, basePlan());
  assert.equal(result.status, 'needs_info');
  assert.ok(codes(result).includes('missing_input'));
});

test('缺少步骤起止时间返回 needs_info', () => {
  const plan = basePlan();
  delete plan.steps[0].start;
  delete plan.steps[0].end;
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'needs_info');
  assert.ok(codes(result).includes('missing_input'));
});

test('非法时间格式与倒置区间被判为 invalid_time', () => {
  const plan = basePlan();
  plan.steps[0].start = '9:00';
  plan.steps[1].start = '10:00';
  plan.steps[1].end = '09:40'; // 结束早于开始
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('invalid_time'));
  // 非法区间不参与重叠比较：不应同时报 time_overlap
  assert.ok(!codes(result).includes('time_overlap'));
});

test('原始任务被遗漏被判为 task_coverage', () => {
  const plan = basePlan();
  plan.steps.pop();
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('task_coverage'));
});

test('同一任务重复安排被判为 task_coverage', () => {
  const plan = basePlan();
  plan.steps.push(step({ id: 'step-3', taskId: 'check-in', start: '10:00', end: '10:20' }));
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  const coverage = result.issues.filter((item) => item.code === 'task_coverage');
  assert.ok(coverage.length >= 1);
});

test('引用未知 taskId 被判为 task_coverage', () => {
  const plan = basePlan();
  plan.steps[1].taskId = 'unknown-task';
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('task_coverage'));
});

test('步骤 id 重复被判为 dependency_conflict', () => {
  const plan = basePlan();
  plan.steps[1].id = 'step-1';
  plan.steps[1].dependsOn = [];
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('dependency_conflict'));
});

test('依赖了不存在的步骤被判为 dependency_conflict', () => {
  const plan = basePlan();
  plan.steps[1].dependsOn = ['step-404'];
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('dependency_conflict'));
});

test('依赖环被判为 dependency_conflict，且不死循环', () => {
  const plan = basePlan();
  plan.steps[0].dependsOn = ['step-2'];
  plan.steps[1].dependsOn = ['step-1'];
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('dependency_conflict'));
});

test('依赖未在本步骤前结束被判为 dependency_conflict', () => {
  const plan = basePlan();
  plan.steps[1].start = '09:20'; // step-1 到 09:30 才结束
  plan.steps[1].end = '10:00';
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('dependency_conflict'));
});

test('步骤没有依据被判为 missing_evidence（needs_info）', () => {
  const plan = basePlan();
  plan.steps[0].evidenceIds = [];
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'needs_info');
  assert.ok(codes(result).includes('missing_evidence'));
});

test('引用不存在的 evidence id 被判为 missing_evidence', () => {
  const plan = basePlan();
  plan.steps[0].evidenceIds = ['fixture-404'];
  const result = verifyPlan(baseRequest(), plan);
  assert.equal(result.status, 'needs_info');
  assert.ok(codes(result).includes('missing_evidence'));
});

test('真实计划使用模拟依据被判为 unverified_evidence', () => {
  const request = baseRequest({ simulation: false });
  const result = verifyPlan(request, basePlan());
  assert.equal(result.status, 'needs_info');
  assert.ok(codes(result).includes('unverified_evidence'));
});

test('未核实的 official 依据被判为 unverified_evidence', () => {
  const request = baseRequest({
    simulation: false,
    evidence: [
      { id: 'fixture-1', kind: 'official', source: '模拟的通知文件', summary: '尚未核实', verified: false },
    ],
  });
  const result = verifyPlan(request, basePlan());
  assert.equal(result.status, 'needs_info');
  assert.ok(codes(result).includes('unverified_evidence'));
});

test('模拟计划允许使用 simulation 依据', () => {
  const result = verifyPlan(baseRequest({ simulation: true }), basePlan());
  assert.equal(result.status, 'passed');
  assert.ok(!codes(result).includes('unverified_evidence'));
});

test('已核实的 official 依据可通过', () => {
  const request = baseRequest({
    simulation: false,
    evidence: [
      { id: 'fixture-1', kind: 'official', source: '模拟的通知文件', summary: '已由资料环节核实', verified: true },
    ],
  });
  const result = verifyPlan(request, basePlan());
  assert.equal(result.status, 'passed');
});

test('步骤超出任务开放时段被判为 outside_service_window', () => {
  const request = baseRequest({
    tasks: [
      { id: 'check-in', title: '学院登记', serviceWindow: { start: '09:00', end: '09:20' } },
      { id: 'dorm', title: '办理入住', serviceWindow: { start: '09:00', end: '12:00' } },
    ],
  });
  const result = verifyPlan(request, basePlan()); // step-1 到 09:30
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('outside_service_window'));
});

test('任务缺开放时段只给 warning，不编造时间', () => {
  const request = baseRequest({
    tasks: [
      { id: 'check-in', title: '学院登记' },
      { id: 'dorm', title: '办理入住', serviceWindow: { start: '09:00', end: '12:00' } },
    ],
  });
  const result = verifyPlan(request, basePlan());
  assert.equal(result.status, 'passed');
  const warning = result.issues.find((item) => item.code === 'unknown_service_window');
  assert.ok(warning);
  assert.equal(warning.severity, 'warning');
});

test('状态优先级：有 error 时即使同时有 needs_info 也返回 revise', () => {
  const request = baseRequest({ simulation: false }); // 触发 unverified_evidence
  const plan = basePlan();
  plan.steps[1].campus = 'haizhu'; // 触发 campus_mismatch（error）
  const result = verifyPlan(request, plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('unverified_evidence'));
  assert.ok(codes(result).includes('campus_mismatch'));
});

test('接口样例：overlap-and-dependency 同时报出时间重叠与依赖顺序', () => {
  const request = {
    campus: 'baiyun',
    availableWindow: { start: '09:00', end: '11:00' },
    simulation: true,
    tasks: [
      { id: 'check-in', title: '学院登记', serviceWindow: { start: '09:00', end: '11:00' } },
      { id: 'dorm', title: '办理入住', serviceWindow: { start: '09:00', end: '12:00' } },
    ],
    evidence: [
      { id: 'fixture-1', kind: 'simulation', source: '本样例自设场景', summary: '用于测试冲突检出', verified: false },
    ],
  };
  const plan = {
    steps: [
      { id: 'step-1', taskId: 'check-in', title: '学院登记', campus: 'baiyun', start: '09:00', end: '09:45', dependsOn: [], evidenceIds: ['fixture-1'] },
      { id: 'step-2', taskId: 'dorm', title: '办理入住', campus: 'baiyun', start: '09:30', end: '10:00', dependsOn: ['step-1'], evidenceIds: ['fixture-1'] },
    ],
  };
  const result = verifyPlan(request, plan);
  assert.equal(result.status, 'revise');
  assert.ok(codes(result).includes('time_overlap'));
  assert.ok(codes(result).includes('dependency_conflict'));
});

test('两份输入均未被修改（冻结对象下也不抛异常）', () => {
  const request = deepFreeze(baseRequest());
  const plan = deepFreeze(basePlan());
  const before = JSON.stringify({ request, plan });
  const result = verifyPlan(request, plan);
  const after = JSON.stringify({ request, plan });
  assert.equal(before, after);
  assert.equal(result.status, 'passed');
});
