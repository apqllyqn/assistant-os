'use client';

import { useMemo } from 'react';
import { Search, X, AlertTriangle } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

export function TaskFilters() {
  const { tasks, filters, setFilter, clearFilters } = useTaskStore();

  const clients = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => { if (t.clientName) set.add(t.clientName); });
    return Array.from(set).sort();
  }, [tasks]);

  const sourceTypes = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => { if (t.sourceType) set.add(t.sourceType); });
    return Array.from(set).sort();
  }, [tasks]);

  const overdueCount = useMemo(() => {
    const OVERDUE_MS = 7 * 86400000;
    const now = Date.now();
    return tasks.filter((t) => {
      if (t.syncStatus !== 'pending') return false;
      const ref = t.createdAt || t.meetingDate;
      if (!ref) return false;
      return (now - new Date(ref).getTime()) >= OVERDUE_MS;
    }).length;
  }, [tasks]);

  const hasFilters = filters.client || filters.priority || filters.status || filters.sourceType || filters.search || filters.overdue;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Overdue chip */}
      {overdueCount > 0 && (
        <button
          onClick={() => setFilter('overdue', filters.overdue ? null : 'true')}
          className={cn(
            'flex items-center gap-1.5 h-9 px-3 rounded-md border text-sm font-medium transition-colors',
            filters.overdue
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-background border-dashed border-red-300 text-red-600 hover:bg-red-50'
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Overdue ({overdueCount})
        </button>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value || null)}
          className="h-9 w-56 rounded-md border bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Client filter */}
      <select
        value={filters.client || ''}
        onChange={(e) => setFilter('client', e.target.value || null)}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">All Clients</option>
        {clients.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Priority filter */}
      <select
        value={filters.priority || ''}
        onChange={(e) => setFilter('priority', e.target.value || null)}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">All Priorities</option>
        <option value="URGENT">Urgent</option>
        <option value="HIGH">High</option>
        <option value="MEDIUM">Medium</option>
        <option value="LOW">Low</option>
      </select>

      {/* Status filter */}
      <select
        value={filters.status || ''}
        onChange={(e) => setFilter('status', e.target.value || null)}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="pushed">Pushed</option>
        <option value="dismissed">Dismissed</option>
      </select>

      {/* Source type filter */}
      <select
        value={filters.sourceType || ''}
        onChange={(e) => setFilter('sourceType', e.target.value || null)}
        className="h-9 rounded-md border bg-background px-3 text-sm"
      >
        <option value="">All Sources</option>
        {sourceTypes.map((s) => (
          <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase()}</option>
        ))}
      </select>

      {/* Clear filters */}
      {hasFilters && (
        <button
          onClick={clearFilters}
          className="flex items-center gap-1 h-9 px-3 text-sm text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}
