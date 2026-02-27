import type { ClientMap, Task, SyncEntry } from '@/lib/types/task';
import { readClientMap } from './tasks';

const PRIORITY_MAP: Record<string, number> = {
  URGENT: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
};

const TAG_MAP: Record<string, string> = {
  MEETING_RECORDING_FOLLOWUP: 'meeting-followup',
  EMAIL_RESPONSE: 'email-response',
  SUPPORT: 'support',
  FOLLOWUP: 'followup',
  FEATURE_REQUEST: 'feature-request',
  SCHEDULE_MEETING: 'schedule-meeting',
  NUDGE: 'nudge',
  OTHER: 'other',
};

function formatDescription(task: Task, meetingSummary?: string): string {
  const parts: string[] = [];

  // Meeting context section (if task came from a meeting)
  if (task.meetingTitle) {
    parts.push('**Meeting Context:**');
    parts.push(`- Meeting: ${task.meetingTitle}`);
    if (task.meetingDate) {
      parts.push(`- Date: ${new Date(task.meetingDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`);
    }
    if (task.meetingAttendees.length > 0) {
      parts.push(`- Attendees: ${task.meetingAttendees.join(', ')}`);
    }
    if (meetingSummary) {
      parts.push(`- Summary: ${meetingSummary.slice(0, 200)}${meetingSummary.length > 200 ? '...' : ''}`);
    }
    parts.push('');
  }

  if (task.description) {
    parts.push(task.description);
  }

  if (task.descriptionPoints.length > 0) {
    parts.push('\n**Action Items:**');
    task.descriptionPoints.forEach((point) => {
      parts.push(`- ${point}`);
    });
  }

  if (task.people.length > 0) {
    parts.push(`\n**People:** ${task.people.join(', ')}`);
  }

  parts.push(`**Priority:** ${task.priority}`);

  if (task.sourceLabel) {
    parts.push(`**Source:** ${task.sourceLabel}`);
  }

  parts.push(`\n---\n*Synced from Day.ai on ${new Date().toISOString().split('T')[0]}*`);
  parts.push(`*Day.ai Action ID: ${task.objectId}*`);

  return parts.join('\n');
}

export async function createClickUpTask(task: Task, meetingSummary?: string): Promise<{ taskId: string; url: string }> {
  const clientMap = await readClientMap();

  if (!task.clickupListId) {
    throw new Error(`No ClickUp list ID for task "${task.title}"`);
  }

  const body: Record<string, unknown> = {
    name: task.title,
    description: formatDescription(task, meetingSummary),
    priority: PRIORITY_MAP[task.priority] ?? 3,
    tags: [TAG_MAP[task.sourceType] ?? 'other'],
  };

  if (task.dueDate) {
    body.due_date = new Date(task.dueDate).getTime();
  }

  const response = await fetch(
    `https://api.clickup.com/api/v2/list/${task.clickupListId}/task`,
    {
      method: 'POST',
      headers: {
        Authorization: clientMap.clickupApiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ClickUp API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return { taskId: data.id, url: data.url };
}
