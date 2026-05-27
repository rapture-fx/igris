import type { Task } from '@/hooks/useTasks';

export interface ConsoleAction {
  id: string;
  name: string;
  target: string;
  policy: string;
  lastRun?: Task;
  runs: Task[];
  proofStatus: string;
}

export function actionDisplayName(task: Task): string {
  return task.policy?.action_name || task.task_type || 'Unnamed action';
}

export function actionId(name: string): string {
  return encodeURIComponent(name);
}

export function targetForTask(task?: Task): string {
  if (!task) return 'Not available';
  const firstTarget = task.action_evidence?.find((row) => row.target_summary)?.target_summary;
  return firstTarget || task.runtime_boundary?.environment_label || task.runtime_id || 'Not available';
}

export function policyForTask(task?: Task): string {
  if (!task?.policy) return 'Not available';
  const decision = task.policy.decision?.replace(/_/g, ' ') ?? 'policy';
  return task.policy.policy_version ? `${decision}, v${task.policy.policy_version}` : decision;
}

export function proofForTask(task?: Task): string {
  const proof = task?.proof;
  if (!proof) return 'Proof unavailable';
  if (proof.verified || proof.status === 'verified') return 'Proof verified';
  if (proof.verified === false || proof.status === 'mismatch') return 'Proof failed';
  if (proof.status === 'present') return 'Receipt present';
  if (proof.status === 'pending') return 'Proof pending';
  return 'Proof unavailable';
}

export function buildActions(tasks: Task[]): ConsoleAction[] {
  const order: string[] = [];
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    const name = actionDisplayName(task);
    if (!grouped.has(name)) {
      order.push(name);
      grouped.set(name, []);
    }
    grouped.get(name)!.push(task);
  }

  return order.map((name) => {
    const runs = grouped.get(name) ?? [];
    const lastRun = runs[0];
    return {
      id: actionId(name),
      name,
      target: targetForTask(lastRun),
      policy: policyForTask(lastRun),
      proofStatus: proofForTask(lastRun),
      lastRun,
      runs,
    };
  });
}
