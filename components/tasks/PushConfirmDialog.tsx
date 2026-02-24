'use client';

import { useState } from 'react';
import { ArrowUpToLine, Loader2 } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { toast } from 'sonner';
import type { EnrichedTask } from '@/lib/types/task';

interface Props {
  open: boolean;
  onClose: () => void;
  tasks: EnrichedTask[];
}

export function PushConfirmDialog({ open, onClose, tasks }: Props) {
  const { pushTasks } = useTaskStore();
  const [pushing, setPushing] = useState(false);

  if (!open) return null;

  const pushable = tasks.filter((t) => t.clickupListId && t.syncStatus === 'pending');
  const unpushable = tasks.filter((t) => !t.clickupListId);

  const handlePush = async () => {
    setPushing(true);
    const ids = pushable.map((t) => t.objectId);
    const results = await pushTasks(ids);
    setPushing(false);

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (succeeded > 0) {
      toast.success(`Pushed ${succeeded} task(s) to ClickUp`);
    }
    if (failed > 0) {
      toast.error(`${failed} task(s) failed to push`);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Push to ClickUp</h2>

        <div className="space-y-2 max-h-64 overflow-auto mb-4">
          {pushable.map((t) => (
            <div key={t.objectId} className="flex items-center justify-between text-sm border rounded-md p-2">
              <span className="truncate flex-1">{t.title}</span>
              <span className="text-xs text-primary ml-2 flex-shrink-0">
                {t.clickupFolderName}
              </span>
            </div>
          ))}
        </div>

        {unpushable.length > 0 && (
          <div className="mb-4 rounded-md bg-warning/10 p-3 text-sm text-warning">
            {unpushable.length} task(s) have no ClickUp folder match and will be skipped.
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={pushing}
            className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handlePush}
            disabled={pushing || pushable.length === 0}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {pushing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowUpToLine className="h-4 w-4" />
            )}
            {pushing ? 'Pushing...' : `Push ${pushable.length} task(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}
