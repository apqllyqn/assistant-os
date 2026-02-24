import { promises as fs } from 'fs';
import path from 'path';
import type { TasksFile, SyncLedger, SyncEntry, ClientMap, Task, EnrichedTask, TaskStats, FolderOption, TaskEditRequest } from '@/lib/types/task';

const DATA_DIR = path.join(process.cwd(), 'data');

function getPath(file: string) {
  return path.join(DATA_DIR, file);
}

export async function readTasksFile(): Promise<TasksFile> {
  try {
    const raw = await fs.readFile(getPath('tasks.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { version: 1, refreshedAt: null, tasks: [], dismissed: [] };
  }
}

export async function writeTasksFile(data: TasksFile): Promise<void> {
  await fs.writeFile(getPath('tasks.json'), JSON.stringify(data, null, 2));
}

export async function readSyncLedger(): Promise<SyncLedger> {
  try {
    const raw = await fs.readFile(getPath('sync-ledger.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function writeSyncLedger(data: SyncLedger): Promise<void> {
  await fs.writeFile(getPath('sync-ledger.json'), JSON.stringify(data, null, 2));
}

export async function readClientMap(): Promise<ClientMap> {
  const raw = await fs.readFile(getPath('client-map.json'), 'utf-8');
  return JSON.parse(raw);
}

export async function getEnrichedTasks(): Promise<{ tasks: EnrichedTask[]; refreshedAt: string | null; stats: TaskStats }> {
  const [tasksFile, ledger] = await Promise.all([readTasksFile(), readSyncLedger()]);

  const enriched: EnrichedTask[] = tasksFile.tasks.map((task) => {
    if (ledger[task.objectId]) {
      const entry = ledger[task.objectId];
      return {
        ...task,
        syncStatus: 'pushed' as const,
        clickupTaskId: entry.clickupTaskId,
        clickupUrl: entry.clickupUrl,
        syncedAt: entry.syncedAt,
      };
    }
    if (tasksFile.dismissed.includes(task.objectId)) {
      return { ...task, syncStatus: 'dismissed' as const };
    }
    return { ...task, syncStatus: 'pending' as const };
  });

  const stats: TaskStats = {
    total: enriched.length,
    pending: enriched.filter((t) => t.syncStatus === 'pending').length,
    pushed: enriched.filter((t) => t.syncStatus === 'pushed').length,
    dismissed: enriched.filter((t) => t.syncStatus === 'dismissed').length,
    unresolvedClient: enriched.filter((t) => !t.clientDomain).length,
  };

  return { tasks: enriched, refreshedAt: tasksFile.refreshedAt, stats };
}

export async function dismissTasks(taskIds: string[]): Promise<void> {
  const tasksFile = await readTasksFile();
  const newDismissed = new Set([...tasksFile.dismissed, ...taskIds]);
  tasksFile.dismissed = Array.from(newDismissed);
  await writeTasksFile(tasksFile);
}

export async function addSyncEntry(objectId: string, entry: SyncEntry): Promise<void> {
  const ledger = await readSyncLedger();
  ledger[objectId] = entry;
  await writeSyncLedger(ledger);
}

export async function writeClientMap(data: ClientMap): Promise<void> {
  await fs.writeFile(getPath('client-map.json'), JSON.stringify(data, null, 2));
}

export async function getFolderOptions(): Promise<FolderOption[]> {
  const clientMap = await readClientMap();
  const folders: FolderOption[] = [];

  // Build a lookup from folderId -> { listId, listName }
  // Priority: folderLists table > clients table
  const folderToList = new Map<string, { listId: string; listName: string }>();

  // From folderLists (comprehensive)
  const folderLists = (clientMap as Record<string, unknown>).folderLists as Record<string, { listId: string; listName: string }> | undefined;
  if (folderLists) {
    for (const [folderId, info] of Object.entries(folderLists)) {
      folderToList.set(folderId, info);
    }
  }

  // From clients (override with more specific data)
  for (const client of Object.values(clientMap.clients)) {
    if (client.folderId && client.listId) {
      folderToList.set(client.folderId, { listId: client.listId, listName: client.listName });
    }
  }

  for (const [spaceName, space] of Object.entries(clientMap.spaces)) {
    for (const [folderName, folderId] of Object.entries(space.folders)) {
      const listInfo = folderToList.get(folderId);
      folders.push({
        listId: listInfo?.listId || null,
        folderId,
        folderName,
        spaceName,
        listName: listInfo?.listName || null,
        displayLabel: `${spaceName} > ${folderName}`,
      });
    }
  }

  folders.sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
  return folders;
}

export async function assignTaskFolder(
  taskId: string,
  listId: string,
  folderId: string,
  folderName: string,
  spaceName: string,
): Promise<Task> {
  const tasksFile = await readTasksFile();
  const taskIndex = tasksFile.tasks.findIndex((t) => t.objectId === taskId);
  if (taskIndex === -1) throw new Error('Task not found');

  const task = tasksFile.tasks[taskIndex];
  task.clickupListId = listId;
  task.clickupFolderName = folderName;
  task.clickupSpaceName = spaceName;

  await writeTasksFile(tasksFile);

  // If task has a client domain, save the mapping for future auto-resolution
  if (task.clientDomain) {
    const clientMap = await readClientMap();
    if (!clientMap.clients[task.clientDomain]) {
      clientMap.clients[task.clientDomain] = {
        name: task.clientName || folderName,
        folderId,
        listId,
        listName: 'Projects',
        space: spaceName,
      };
      await writeClientMap(clientMap);
    }
  }

  return task;
}

export async function editTask(taskId: string, edits: TaskEditRequest): Promise<Task> {
  const tasksFile = await readTasksFile();
  const taskIndex = tasksFile.tasks.findIndex((t) => t.objectId === taskId);
  if (taskIndex === -1) throw new Error('Task not found');

  const task = tasksFile.tasks[taskIndex];
  if (edits.title !== undefined) task.title = edits.title;
  if (edits.priority !== undefined) task.priority = edits.priority;
  if (edits.dueDate !== undefined) task.dueDate = edits.dueDate;

  await writeTasksFile(tasksFile);
  return task;
}
