'use client';

import { useMemo } from 'react';
import { Search, X, AlertTriangle, ArrowUpDown, Calendar, Layers, Eye, EyeOff } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import type { SortField, SortDirection, GroupMode, DateRange } from '@/lib/types/task';

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

  const filteredCount = useMemo(() =>
    tasks.filter((t) => t.isFiltered).length
  , [tasks]);

  const hasFilters = filters.client || filters.priority || filters.status || filters.sourceType || filters.search || filters.overdue;

  return (
    <div className="space-y-2">
      {/* Row 1: Sort, Group, Date Range */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Sort field */}
        <div className="flex items-center gap-1">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={filters.sortField}
            onChange={(e) => setFilter('sortField', e.target.value as SortField)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="date">Sort by Date</option>
            <option value="priority">Sort by Priority</option>
            <option value="client">Sort by Client</option>
          </select>
          <button
            onClick={() => setFilter('sortDirection', filters.sortDirection === 'desc' ? 'asc' : 'desc')}
            className="h-8 px-2 rounded-md border bg-background text-xs hover:bg-accent"
            title={filters.sortDirection === 'desc' ? 'Newest first' : 'Oldest first'}
          >
            {filters.sortDirection === 'desc' ? '↓ New' : '↑ Old'}
          </button>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border" />

        {/* Group mode */}
        <div className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={filters.groupMode}
            onChange={(e) => setFilter('groupMode', e.target.value as GroupMode)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="meeting">Group by Meeting</option>
            <option value="client">Group by Client</option>
            <option value="none">No Grouping</option>
          </select>
        </div>

        {/* Separator */}
        <div className="h-5 w-px bg-border" />

        {/* Date range */}
        <div className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {(['today', '7d', '30d', 'all'] as DateRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setFilter('dateRange', range)}
              className={cn(
                'h-8 px-2.5 rounded-md text-xs font-medium transition-colors',
                filters.dateRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background border hover:bg-accent'
              )}
            >
              {range === 'today' ? 'Today' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : 'All'}
            </button>
          ))}
        </div>

        {/* Show filtered toggle */}
        {filteredCount > 0 && (
          <>
            <div className="h-5 w-px bg-border" />
            <button
              onClick={() => setFilter('showFiltered', filters.showFiltered ? null : 'true')}
              className={cn(
                'flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-colors',
                filters.showFiltered
                  ? 'bg-amber-100 border-amber-300 text-amber-700 border'
                  : 'bg-background border text-muted-foreground hover:bg-accent'
              )}
            >
              {filters.showFiltered ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {filteredCount} noise
            </button>
          </>
        )}
      </div>

      {/* Row 2: Filters */}
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
    </div>
  );
}
