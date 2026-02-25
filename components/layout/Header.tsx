'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { timeAgo, cn } from '@/lib/utils';
import { toast } from 'sonner';

function freshness(refreshedAt: string | null): { color: string; dotClass: string } {
  if (!refreshedAt) return { color: 'text-red-600', dotClass: 'bg-red-500' };
  const hours = (Date.now() - new Date(refreshedAt).getTime()) / 3600000;
  if (hours < 4) return { color: 'text-muted-foreground', dotClass: 'bg-green-500' };
  if (hours < 8) return { color: 'text-yellow-600', dotClass: 'bg-yellow-500' };
  return { color: 'text-red-600', dotClass: 'bg-red-500' };
}

export function Header() {
  const { refreshedAt, isLoading, fetchTasks } = useTaskStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { color, dotClass } = freshness(refreshedAt);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          toast.info(data.message || 'Refreshed recently — try again later');
        } else {
          toast.error(data.error || 'Refresh failed');
        }
      } else {
        const data = await res.json();
        toast.success(`Refreshed — ${data.added} new task${data.added !== 1 ? 's' : ''}`);
        await fetchTasks();
      }
    } catch {
      toast.error('Refresh failed — check connection');
    } finally {
      setIsRefreshing(false);
    }
  };

  const spinning = isLoading || isRefreshing;

  return (
    <div className="flex h-14 items-center justify-between border-b px-6">
      <h1 className="text-lg font-semibold">Task Triage</h1>
      <div className="flex items-center gap-3">
        {refreshedAt ? (
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', dotClass)} />
            <span className={cn('text-xs', color)}>
              Updated {timeAgo(refreshedAt)}
            </span>
          </div>
        ) : (
          <span className="text-xs text-red-600">
            No data yet
          </span>
        )}
        <button
          onClick={handleRefresh}
          disabled={spinning}
          className="p-2 rounded-md hover:bg-accent disabled:opacity-50"
          title="Refresh from Day.ai"
        >
          <RefreshCw className={cn('h-4 w-4', spinning && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}
