'use client';

import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { timeAgo, cn } from '@/lib/utils';

function isStale(refreshedAt: string | null): boolean {
  if (!refreshedAt) return true;
  const diff = Date.now() - new Date(refreshedAt).getTime();
  return diff > 4 * 60 * 60 * 1000; // 4 hours
}

export function Header() {
  const { refreshedAt, isLoading, fetchTasks } = useTaskStore();
  const stale = isStale(refreshedAt);

  return (
    <div>
      {stale && refreshedAt && (
        <div className="flex items-center gap-2 bg-yellow-50 border-b border-yellow-200 px-6 py-2 text-xs text-yellow-800">
          <AlertTriangle className="h-3.5 w-3.5" />
          Task data is stale (last updated {timeAgo(refreshedAt)}). Run <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-mono">/refresh-tasks</code> in Claude Code to pull latest actions.
        </div>
      )}
      <div className="flex h-14 items-center justify-between border-b px-6">
        <h1 className="text-lg font-semibold">Task Triage</h1>
        <div className="flex items-center gap-3">
          {refreshedAt && (
            <span className="text-xs text-muted-foreground">
              Updated {timeAgo(refreshedAt)}
            </span>
          )}
          {!refreshedAt && (
            <span className="text-xs text-warning">
              No data — run /refresh-tasks
            </span>
          )}
          <button
            onClick={() => fetchTasks()}
            disabled={isLoading}
            className="p-2 rounded-md hover:bg-accent disabled:opacity-50"
            title="Reload from disk"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>
    </div>
  );
}
