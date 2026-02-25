'use client';

import { StatsBar } from '@/components/dashboard/StatsBar';
import { TaskFilters } from '@/components/tasks/TaskFilters';
import { TaskList } from '@/components/tasks/TaskList';
import { BulkActions } from '@/components/tasks/BulkActions';
import { useTaskStore } from '@/lib/stores';

export default function TasksPage() {
  const { tasks, isLoading, stats } = useTaskStore();

  if (isLoading && tasks.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-muted animate-pulse rounded-lg" />
        <div className="h-12 bg-muted animate-pulse rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats.total && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="text-6xl mb-4">📋</div>
        <h2 className="text-xl font-semibold mb-2">No tasks yet</h2>
        <p className="text-muted-foreground max-w-md">
          Click the refresh button in the header to pull action items from Day.ai, or wait for the next auto-refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StatsBar />
      <TaskFilters />
      <BulkActions />
      <TaskList />
    </div>
  );
}
