import { promises as fs } from 'fs';
import path from 'path';
import { readTasksFile, writeTasksFile, readClientMap } from './api/tasks';
import { fetchActions, transformAction } from './dayai-client';
import type { Task, TasksFile } from './types/task';

let lastRefreshTime = 0;
const RATE_LIMIT_MS = 60_000; // 1 minute

export interface RefreshResult {
  added: number;
  total: number;
  refreshedAt: string;
}

export async function refreshTasks(): Promise<RefreshResult> {
  // Rate limit
  const now = Date.now();
  if (now - lastRefreshTime < RATE_LIMIT_MS) {
    const tasksFile = await readTasksFile();
    return {
      added: 0,
      total: tasksFile.tasks.length,
      refreshedAt: tasksFile.refreshedAt || new Date().toISOString(),
    };
  }

  const clientMap = await readClientMap();
  const actions = await fetchActions();
  const tasksFile = await readTasksFile();

  // Build set of existing objectIds
  const existingIds = new Set(tasksFile.tasks.map((t) => t.objectId));

  // Transform new actions
  let added = 0;
  for (const action of actions) {
    if (existingIds.has(action.objectId)) continue;

    const task = transformAction(action, clientMap.ownDomain);

    // Auto-resolve client from client-map
    if (task.clientDomain && clientMap.clients[task.clientDomain]) {
      const client = clientMap.clients[task.clientDomain];
      task.clientName = client.name;
      (task as Task).clickupListId = client.listId;
      (task as Task).clickupFolderName = client.name;
      (task as Task).clickupSpaceName = client.space;
    }

    tasksFile.tasks.push(task as Task);
    added++;
  }

  // Prune dismissed tasks older than 30 days
  const PRUNE_MS = 30 * 86400000;
  const cutoff = now - PRUNE_MS;
  const dismissedSet = new Set(tasksFile.dismissed);
  tasksFile.tasks = tasksFile.tasks.filter((t) => {
    if (!dismissedSet.has(t.objectId)) return true;
    const ref = t.createdAt || t.meetingDate;
    if (!ref) return true;
    return new Date(ref).getTime() > cutoff;
  });
  // Also clean dismissed array
  const remainingIds = new Set(tasksFile.tasks.map((t) => t.objectId));
  tasksFile.dismissed = tasksFile.dismissed.filter((id) => remainingIds.has(id));

  // Update timestamp
  const refreshedAt = new Date().toISOString();
  tasksFile.refreshedAt = refreshedAt;

  // Atomic write: write to temp, then rename
  const dataDir = path.join(process.cwd(), 'data');
  const tmpPath = path.join(dataDir, 'tasks.json.tmp');
  const finalPath = path.join(dataDir, 'tasks.json');
  await fs.writeFile(tmpPath, JSON.stringify(tasksFile, null, 2));
  await fs.rename(tmpPath, finalPath);

  lastRefreshTime = now;

  return { added, total: tasksFile.tasks.length, refreshedAt };
}

export function isRateLimited(): boolean {
  return Date.now() - lastRefreshTime < RATE_LIMIT_MS;
}

export function secondsUntilNextRefresh(): number {
  const remaining = RATE_LIMIT_MS - (Date.now() - lastRefreshTime);
  return Math.max(0, Math.ceil(remaining / 1000));
}
