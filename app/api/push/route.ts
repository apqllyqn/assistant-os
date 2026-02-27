import { NextRequest, NextResponse } from 'next/server';
import { readTasksFile, addSyncEntry } from '@/lib/api/tasks';
import { createClickUpTask } from '@/lib/api/clickup';
import { fetchMeetingContext } from '@/lib/dayai-client';
import type { PushResult, SyncEntry, Task } from '@/lib/types/task';

// Simple in-memory cache for meeting summaries during bulk push
const summaryCache = new Map<string, string>();

async function getMeetingSummary(meetingId: string | null): Promise<string | undefined> {
  if (!meetingId) return undefined;
  if (summaryCache.has(meetingId)) return summaryCache.get(meetingId);

  try {
    const ctx = await fetchMeetingContext(meetingId);
    if (ctx?.summary) {
      summaryCache.set(meetingId, ctx.summary);
      return ctx.summary;
    }
  } catch {
    // Non-critical — push without meeting summary
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const { taskIds } = (await request.json()) as { taskIds: string[] };

    if (!taskIds || taskIds.length === 0) {
      return NextResponse.json({ error: 'No task IDs provided' }, { status: 400 });
    }

    const tasksFile = await readTasksFile();
    const taskMap = new Map(tasksFile.tasks.map((t) => [t.objectId, t]));

    const results: PushResult[] = [];

    for (const id of taskIds) {
      const task = taskMap.get(id);
      if (!task) {
        results.push({ taskId: id, success: false, error: 'Task not found' });
        continue;
      }
      if (!task.clickupListId) {
        results.push({ taskId: id, success: false, error: 'No ClickUp list mapped for client' });
        continue;
      }

      try {
        const meetingSummary = await getMeetingSummary(task.meetingId);
        const { taskId: clickupTaskId, url: clickupUrl } = await createClickUpTask(task, meetingSummary);

        const entry: SyncEntry = {
          clickupTaskId,
          clickupUrl,
          clickupListId: task.clickupListId,
          clientDomain: task.clientDomain || '',
          clientName: task.clientName || '',
          syncedAt: new Date().toISOString(),
          title: task.title,
        };

        await addSyncEntry(id, entry);

        results.push({ taskId: id, success: true, clickupTaskId, clickupUrl });
      } catch (err) {
        results.push({ taskId: id, success: false, error: (err as Error).message });
      }

      // Small delay to avoid ClickUp rate limits
      if (taskIds.length > 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
