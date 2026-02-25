import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

export function priorityColor(priority: string): string {
  const colors: Record<string, string> = {
    URGENT: 'text-red-600 bg-red-50',
    HIGH: 'text-orange-600 bg-orange-50',
    MEDIUM: 'text-yellow-600 bg-yellow-50',
    LOW: 'text-blue-600 bg-blue-50',
  };
  return colors[priority] || 'text-muted-foreground bg-muted';
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    pushed: 'bg-green-100 text-green-800',
    dismissed: 'bg-gray-100 text-gray-500',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
}

export function getTaskAge(createdAt: string | null, meetingDate: string | null): { days: number; label: string; color: 'green' | 'yellow' | 'red' } {
  const ref = createdAt || meetingDate;
  if (!ref) return { days: 0, label: '?', color: 'green' };
  const diffMs = Date.now() - new Date(ref).getTime();
  const days = Math.max(0, Math.floor(diffMs / 86400000));
  const label = days === 0 ? 'today' : `${days}d`;
  const color = days < 3 ? 'green' : days < 7 ? 'yellow' : 'red';
  return { days, label, color };
}

export function sourceTypeLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    MEETING_RECORDING_FOLLOWUP: 'Meeting',
    EMAIL_RESPONSE: 'Email',
    SUPPORT: 'Support',
    FOLLOWUP: 'Follow-up',
    FEATURE_REQUEST: 'Feature',
    SCHEDULE_MEETING: 'Schedule',
    NUDGE: 'Nudge',
    OTHER: 'Other',
  };
  return labels[sourceType] || sourceType;
}
