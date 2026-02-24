'use client';

import { useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { TaskCard } from './TaskCard';
import type { EnrichedTask } from '@/lib/types/task';

export function TaskList() {
  const { tasks, filters, selectedIds, selectAll, deselectAll } = useTaskStore();

  const filtered = useMemo(() => {
    let result = tasks;
    if (filters.client) result = result.filter((t) => t.clientName === filters.client);
    if (filters.priority) result = result.filter((t) => t.priority === filters.priority);
    if (filters.status) result = result.filter((t) => t.syncStatus === filters.status);
    if (filters.sourceType) result = result.filter((t) => t.sourceType === filters.sourceType);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.people.some((p) => p.toLowerCase().includes(q))
      );
    }
    return result;
  }, [tasks, filters]);

  const grouped = useMemo(() => {
    const map = new Map<string, EnrichedTask[]>();
    filtered.forEach((t) => {
      const key = t.clientName || 'Unresolved';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    // Sort groups: Unresolved last
    const entries = Array.from(map.entries());
    entries.sort((a, b) => {
      if (a[0] === 'Unresolved') return 1;
      if (b[0] === 'Unresolved') return -1;
      return a[0].localeCompare(b[0]);
    });
    return entries;
  }, [filtered]);

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

      {grouped.map(([clientName, clientTasks]) => (
        <ClientGroup key={clientName} name={clientName} tasks={clientTasks} />
      ))}
    </div>
  );
}

function ClientGroup({ name, tasks }: { name: string; tasks: EnrichedTask[] }) {
  const pending = tasks.filter((t) => t.syncStatus === 'pending').length;
  const space = tasks[0]?.clickupSpaceName;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 py-1">
        <h3 className="text-sm font-semibold">{name}</h3>
        {space && (
          <span className="text-xs text-muted-foreground">{space}</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {pending} pending / {tasks.length} total
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.objectId} task={task} />
        ))}
      </div>
    </div>
  );
}
