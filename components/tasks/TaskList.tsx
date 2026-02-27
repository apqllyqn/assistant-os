'use client';

import { useMemo } from 'react';
import { Video, Building2 } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { TaskCard } from './TaskCard';
import { cn } from '@/lib/utils';
import type { EnrichedTask, SortField, SortDirection } from '@/lib/types/task';

const PRIORITY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function sortTasks(tasks: EnrichedTask[], field: SortField, direction: SortDirection): EnrichedTask[] {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'date': {
        const da = new Date(a.createdAt || a.meetingDate || '2000-01-01').getTime();
        const db = new Date(b.createdAt || b.meetingDate || '2000-01-01').getTime();
        cmp = da - db;
        break;
      }
      case 'priority': {
        cmp = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
        break;
      }
      case 'client': {
        const ca = a.clientName || 'zzz';
        const cb = b.clientName || 'zzz';
        cmp = ca.localeCompare(cb);
        break;
      }
    }
    return direction === 'desc' ? -cmp : cmp;
  });
  return sorted;
}

function getDateRangeCutoff(range: string): number {
  const now = Date.now();
  switch (range) {
    case 'today': {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today.getTime();
    }
    case '7d': return now - 7 * 86400000;
    case '30d': return now - 30 * 86400000;
    default: return 0;
  }
}

export function TaskList() {
  const { tasks, filters, selectedIds, selectAll, deselectAll } = useTaskStore();

  const filtered = useMemo(() => {
    let result = tasks;

    // Hide noise tasks unless showFiltered is on
    if (!filters.showFiltered) {
      result = result.filter((t) => !t.isFiltered);
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const cutoff = getDateRangeCutoff(filters.dateRange);
      result = result.filter((t) => {
        const ref = t.createdAt || t.meetingDate;
        if (!ref) return true;
        return new Date(ref).getTime() >= cutoff;
      });
    }

    if (filters.client) result = result.filter((t) => t.clientName === filters.client);
    if (filters.priority) result = result.filter((t) => t.priority === filters.priority);
    if (filters.status) result = result.filter((t) => t.syncStatus === filters.status);
    if (filters.sourceType) result = result.filter((t) => t.sourceType === filters.sourceType);
    if (filters.overdue) {
      const OVERDUE_MS = 7 * 86400000;
      const now = Date.now();
      result = result.filter((t) => {
        if (t.syncStatus !== 'pending') return false;
        const ref = t.createdAt || t.meetingDate;
        if (!ref) return false;
        return (now - new Date(ref).getTime()) >= OVERDUE_MS;
      });
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.people.some((p) => p.toLowerCase().includes(q))
      );
    }

    // Sort
    result = sortTasks(result, filters.sortField, filters.sortDirection);

    return result;
  }, [tasks, filters]);

  const grouped = useMemo(() => {
    if (filters.groupMode === 'none') {
      return [{ key: '__all__', label: '', icon: null as string | null, sublabel: '', tasks: filtered }];
    }

    const map = new Map<string, { label: string; icon: string | null; sublabel: string; tasks: EnrichedTask[] }>();

    filtered.forEach((t) => {
      let key: string;
      let label: string;
      let icon: string | null = null;
      let sublabel = '';

      if (filters.groupMode === 'meeting') {
        if (t.meetingId && t.meetingTitle) {
          key = t.meetingId;
          label = t.meetingTitle;
          icon = 'meeting';
          const d = t.meetingDate || t.createdAt;
          sublabel = d ? new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '';
        } else {
          key = '__no_meeting__';
          label = 'Non-meeting tasks';
          icon = null;
          sublabel = '';
        }
      } else {
        // client grouping
        key = t.clientName || '__unresolved__';
        label = t.clientName || 'Unresolved';
        icon = 'client';
        sublabel = t.clickupSpaceName || '';
      }

      if (!map.has(key)) {
        map.set(key, { label, icon, sublabel, tasks: [] });
      }
      map.get(key)!.tasks.push(t);
    });

    // Sort groups: for meeting mode, sort by most recent task date desc; for client mode, alphabetical
    const entries = Array.from(map.entries());
    if (filters.groupMode === 'meeting') {
      entries.sort((a, b) => {
        // Non-meeting group goes last
        if (a[0] === '__no_meeting__') return 1;
        if (b[0] === '__no_meeting__') return -1;
        // Sort by newest task in group
        const latestA = Math.max(...a[1].tasks.map((t) => new Date(t.createdAt || t.meetingDate || '2000-01-01').getTime()));
        const latestB = Math.max(...b[1].tasks.map((t) => new Date(t.createdAt || t.meetingDate || '2000-01-01').getTime()));
        return latestB - latestA;
      });
    } else {
      entries.sort((a, b) => {
        if (a[0] === '__unresolved__') return 1;
        if (b[0] === '__unresolved__') return -1;
        return a[1].label.localeCompare(b[1].label);
      });
    }

    return entries.map(([key, val]) => ({ key, ...val }));
  }, [filtered, filters.groupMode]);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No tasks match your filters.</p>
      </div>
    );
  }

  const allFilteredIds = filtered.filter((t) => t.syncStatus === 'pending').map((t) => t.objectId);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  return (
    <div className="space-y-6">
      {/* Select all toggle */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => allSelected ? deselectAll() : selectAll(allFilteredIds)}
          className="hover:text-foreground"
        >
          {allSelected ? 'Deselect all' : `Select all pending (${allFilteredIds.length})`}
        </button>
        <span className="text-xs">
          {filtered.length} task{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {grouped.map((group) => (
        <TaskGroup
          key={group.key}
          label={group.label}
          icon={group.icon}
          sublabel={group.sublabel}
          tasks={group.tasks}
          showHeader={filters.groupMode !== 'none'}
        />
      ))}
    </div>
  );
}

function TaskGroup({ label, icon, sublabel, tasks, showHeader }: {
  label: string;
  icon: string | null;
  sublabel: string;
  tasks: EnrichedTask[];
  showHeader: boolean;
}) {
  const pending = tasks.filter((t) => t.syncStatus === 'pending').length;

  return (
    <div className="space-y-2">
      {showHeader && label && (
        <div className="flex items-center gap-2 py-1">
          {icon === 'meeting' && <Video className="h-4 w-4 text-blue-500" />}
          {icon === 'client' && <Building2 className="h-4 w-4 text-muted-foreground" />}
          <h3 className="text-sm font-semibold">{label}</h3>
          {sublabel && (
            <span className="text-xs text-muted-foreground">{sublabel}</span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {pending} pending / {tasks.length} total
          </span>
        </div>
      )}
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.objectId} task={task} />
        ))}
      </div>
    </div>
  );
}
