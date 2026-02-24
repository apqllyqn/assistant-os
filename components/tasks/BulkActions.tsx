'use client';

import { useState } from 'react';
import { ArrowUpToLine, XCircle } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { PushConfirmDialog } from './PushConfirmDialog';
import { toast } from 'sonner';

export function BulkActions() {
  const { selectedIds, tasks, deselectAll, isPushing, dismissTasks } = useTaskStore();
  const [showPushDialog, setShowPushDialog] = useState(false);

  const count = selectedIds.size;
  if (count === 0) return null;

  const selectedTasks = tasks.filter((t) => selectedIds.has(t.objectId));
  const pushable = selectedTasks.filter((t) => t.syncStatus === 'pending' && t.clickupListId);

  const handleDismiss = async () => {
    const ids = selectedTasks
      .filter((t) => t.syncStatus === 'pending')
      .map((t) => t.objectId);
    if (ids.length === 0) return;
    await dismissTasks(ids);
    toast.success(`Dismissed ${ids.length} task(s)`);
  };

  return (
    <>
      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <span className="text-sm font-medium">{count} selected</span>
        <div className="flex-1" />
        {pushable.length > 0 && (
          <button
            onClick={() => setShowPushDialog(true)}
            disabled={isPushing}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <ArrowUpToLine className="h-4 w-4" />
            Push {pushable.length} to ClickUp
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <XCircle className="h-4 w-4" />
          Dismiss
        </button>
        <button
          onClick={deselectAll}
          className="text-sm text-muted-foreground hover:text-foreground px-2"
        >
          Clear
        </button>
      </div>

      <PushConfirmDialog
        open={showPushDialog}
        onClose={() => setShowPushDialog(false)}
        tasks={pushable}
      />
    </>
  );
}
