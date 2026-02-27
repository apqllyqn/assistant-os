'use client';

import { useEffect, useState } from 'react';
import { Video, Users, Calendar, FileText, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useTaskStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import type { EnrichedTask } from '@/lib/types/task';

interface MeetingContext {
  meetingId: string;
  title: string;
  summary: string;
  notes: string;
  attendees: string[];
  createdAt: string;
  fetchedAt: string;
}

// In-memory cache so we don't re-fetch within the same session
const contextCache = new Map<string, MeetingContext>();

export function MeetingContextPanel({
  meetingId,
  open,
  onClose,
}: {
  meetingId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { tasks } = useTaskStore();
  const [context, setContext] = useState<MeetingContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Related tasks from the same meeting
  const relatedTasks = meetingId
    ? tasks.filter((t) => t.meetingId === meetingId)
    : [];

  useEffect(() => {
    if (!meetingId || !open) return;

    // Check client cache
    const cached = contextCache.get(meetingId);
    if (cached) {
      setContext(cached);
      return;
    }

    setLoading(true);
    setError(null);
    setContext(null);

    fetch(`/api/meetings/${meetingId}/context`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load meeting context');
        return res.json();
      })
      .then((data: MeetingContext) => {
        contextCache.set(meetingId, data);
        setContext(data);
      })
      .catch((err) => {
        setError((err as Error).message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [meetingId, open]);

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <SheetContent>
        <SheetHeader>
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-500" />
            <SheetTitle>{context?.title || 'Meeting Context'}</SheetTitle>
          </div>
          {context?.createdAt && (
            <SheetDescription>
              <Calendar className="inline h-3.5 w-3.5 mr-1" />
              {new Date(context.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </SheetDescription>
          )}
        </SheetHeader>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading meeting context...</span>
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-sm text-red-500">
            {error}
          </div>
        )}

        {context && !loading && (
          <div className="space-y-6 pt-4">
            {/* Attendees */}
            {context.attendees.length > 0 && (
              <section>
                <h4 className="flex items-center gap-1.5 text-sm font-medium mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Attendees
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {context.attendees.map((a) => (
                    <span
                      key={a}
                      className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Summary */}
            {context.summary && (
              <section>
                <h4 className="flex items-center gap-1.5 text-sm font-medium mb-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Summary
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {context.summary}
                </p>
              </section>
            )}

            {/* Related tasks */}
            {relatedTasks.length > 0 && (
              <section>
                <h4 className="text-sm font-medium mb-2">
                  Tasks from this meeting ({relatedTasks.length})
                </h4>
                <div className="space-y-1.5">
                  {relatedTasks.map((t) => (
                    <RelatedTaskRow key={t.objectId} task={t} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function RelatedTaskRow({ task }: { task: EnrichedTask }) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
      <div
        className={cn('h-2 w-2 rounded-full flex-shrink-0', {
          'bg-red-500': task.priority === 'URGENT',
          'bg-orange-500': task.priority === 'HIGH',
          'bg-yellow-400': task.priority === 'MEDIUM',
          'bg-blue-400': task.priority === 'LOW',
        })}
      />
      <span className="flex-1 truncate">{task.title}</span>
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', {
        'bg-amber-100 text-amber-700': task.syncStatus === 'pending',
        'bg-green-100 text-green-700': task.syncStatus === 'pushed',
        'bg-gray-100 text-gray-500': task.syncStatus === 'dismissed',
      })}>
        {task.syncStatus}
      </span>
    </div>
  );
}
