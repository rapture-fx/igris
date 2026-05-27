import type { Task } from '@/hooks/useTasks';
import type { ActionDefinition } from '@/hooks/useActions';

export interface ConsoleAction {
  id: string;
  name: string;
  target: string;
  policy: string;
  lastRun?: Task;
  runs: Task[];
  proofStatus: string;
  replayBehavior: string;
  endpoint: string;
  source: 'registry';
  definition: ActionDefinition;
}

export function actionDisplayName(task: Task): string {
  return task.policy?.action_name || task.task_type || 'Unnamed action';
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

export function endpointForAction(name: string): string {
  return `https://api.igrisinertial.com/v1/actions/${encodeURIComponent(name)}/run`;
}

export function targetForActionDefinition(action: ActionDefinition): string {
  if (action.target_type === 'mock_demo') return 'Mock demo target';
  if (action.target_type === 'local_runtime') return 'Local runtime';
  return action.target_url || 'Not configured';
}

export function replayForActionDefinition(action: ActionDefinition): string {
  if (action.irreversible) return 'Replay blocked';
  if (action.replay_class === 'read_only') return 'Read only';
  return action.replay_class.replace(/_/g, ' ');
}

export function buildRegisteredActions(actions: ActionDefinition[], tasks: Task[]): ConsoleAction[] {
  const grouped = new Map<string, Task[]>();
  for (const task of tasks) {
    const name = actionDisplayName(task);
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name)!.push(task);
  }

  return actions.map((action) => {
    const runs = grouped.get(action.name) ?? [];
    const lastRun = runs[0];
    return {
      id: action.id,
      name: action.name,
      target: targetForActionDefinition(action),
      policy: action.policy_preset,
      proofStatus: lastRun ? proofForTask(lastRun) : 'No run yet',
      replayBehavior: replayForActionDefinition(action),
      endpoint: endpointForAction(action.name),
      lastRun,
      runs,
      source: 'registry',
      definition: action,
    };
  });
}
