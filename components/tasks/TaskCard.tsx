'use client';

import { useState } from 'react';
import { ArrowUpToLine, ChevronDown, ChevronRight, ExternalLink, XCircle, Pencil, Check, X, Video } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { cn, priorityColor, statusColor, sourceTypeLabel, getTaskAge } from '@/lib/utils';
import { PushConfirmDialog } from './PushConfirmDialog';
import { FolderPicker } from './FolderPicker';
import { MeetingContextPanel } from './MeetingContextPanel';
import { toast } from 'sonner';
import type { EnrichedTask, FolderOption } from '@/lib/types/task';

const PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const;

export function TaskCard({ task }: { task: EnrichedTask }) {
  const {
    selectedIds, toggleSelect, expandedId, setExpanded,
    editingId, setEditing, dismissTasks, assignFolder, editTask,
  } = useTaskStore();
  const [showPush, setShowPush] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  // Edit state
  const isEditMode = editingId === task.objectId;
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState(task.priority);
  const [editDueDate, setEditDueDate] = useState(task.dueDate || '');
  const [isSaving, setIsSaving] = useState(false);

  const isSelected = selectedIds.has(task.objectId);
  const isExpanded = expandedId === task.objectId;
  const isPending = task.syncStatus === 'pending';
  const hasList = !!task.clickupListId;
  const age = getTaskAge(task.createdAt, task.meetingDate);
  const isOverdue = isPending && age.days >= 7;

  const handleDismiss = async () => {
    await dismissTasks([task.objectId]);
    toast.success('Task dismissed');
  };

  const handleAssign = async (folder: FolderOption) => {
    if (!folder.listId) {
      toast.error('This folder has no list ID configured');
      return;
    }
    setIsAssigning(true);
    const ok = await assignFolder({
      taskId: task.objectId,
      listId: folder.listId,
      folderId: folder.folderId,
      folderName: folder.folderName,
      spaceName: folder.spaceName,
    });
    setIsAssigning(false);
    if (ok) {
      toast.success(`Assigned to ${folder.folderName}`);
    } else {
      toast.error('Failed to assign folder');
    }
  };

  const handleStartEdit = () => {
    setEditTitle(task.title);
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate || '');
    setEditing(task.objectId);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    const edits: Record<string, unknown> = {};
    if (editTitle !== task.title) edits.title = editTitle;
    if (editPriority !== task.priority) edits.priority = editPriority;
    const newDueDate = editDueDate || null;
    if (newDueDate !== task.dueDate) edits.dueDate = newDueDate;

    if (Object.keys(edits).length === 0) {
      setEditing(null);
      setIsSaving(false);
      return;
    }

    const ok = await editTask(task.objectId, edits);
    setIsSaving(false);
    if (ok) {
      toast.success('Task updated');
    } else {
      toast.error('Failed to save changes');
    }
  };

  const handleCancelEdit = () => {
    setEditing(null);
  };

  return (
    <>
      <div className={cn(
        'rounded-lg border bg-card transition-colors',
        isSelected && 'border-primary/40 bg-primary/5',
        task.syncStatus === 'dismissed' && 'opacity-50'
      )}>
        <div className="flex items-start gap-3 p-4">
          {/* Checkbox */}
          {isPending && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(task.objectId)}
              className="mt-1 h-4 w-4 rounded border-gray-300 accent-primary"
            />
          )}

          {/* Priority dot / selector */}
          {isEditMode ? (
            <select
              value={editPriority}
              onChange={(e) => setEditPriority(e.target.value as typeof editPriority)}
              className="mt-0.5 rounded border bg-background px-1 py-0.5 text-xs"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          ) : (
            <div
              className={cn('mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0', {
                'bg-red-500': isOverdue || task.priority === 'URGENT',
                'bg-orange-500': !isOverdue && task.priority === 'HIGH',
                'bg-yellow-400': !isOverdue && task.priority === 'MEDIUM',
                'bg-blue-400': !isOverdue && task.priority === 'LOW',
              })}
              title={isOverdue ? `Auto-escalated — ${age.days} days old (was ${task.priority})` : task.priority}
            />
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              {isEditMode ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 rounded border bg-background px-2 py-1 text-sm font-medium"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => setExpanded(isExpanded ? null : task.objectId)}
                  className="text-sm font-medium text-left hover:text-primary"
                >
                  {task.title}
                </button>
              )}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Age badge */}
                {isPending && (
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', {
                    'bg-green-100 text-green-700': age.color === 'green',
                    'bg-yellow-100 text-yellow-700': age.color === 'yellow',
                    'bg-red-100 text-red-700': age.color === 'red',
                  })} title={isOverdue ? `Overdue — ${age.days} days old` : `${age.days} days old`}>
                    {age.label}
                  </span>
                )}
                {/* Status badge */}
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusColor(task.syncStatus))}>
                  {task.syncStatus}
                </span>
                {/* Source type */}
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {sourceTypeLabel(task.sourceType)}
                </span>
              </div>
            </div>

            {/* Meta line / edit fields */}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              {isEditMode ? (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1">
                    <span>Due:</span>
                    <input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="rounded border bg-background px-1.5 py-0.5 text-xs"
                    />
                  </label>
                </div>
              ) : (
                <>
                  {task.meetingTitle && task.meetingId && (
                    <button
                      onClick={() => setShowMeeting(true)}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <Video className="h-3 w-3" />
                      {task.meetingTitle}
                    </button>
                  )}
                  {task.people.length > 0 && (
                    <span>{task.people.join(', ')}</span>
                  )}
                  {task.dueDate && (
                    <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                  )}
                  {task.clickupFolderName && (
                    <span className="text-primary/70">{task.clickupFolderName}</span>
                  )}
                  {!hasList && task.clientDomain && (
                    <span className="text-orange-500">No folder mapped</span>
                  )}
                  {task.isFiltered && (
                    <span className="text-amber-500 font-medium">noise</span>
                  )}
                </>
              )}
            </div>

            {/* Expanded detail */}
            {isExpanded && !isEditMode && (
              <div className="mt-3 space-y-2 text-sm border-t pt-3">
                {task.description && (
                  <p className="text-muted-foreground">{task.description}</p>
                )}
                {task.descriptionPoints.length > 0 && (
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    {task.descriptionPoints.map((point, i) => (
                      <li key={i}>{point}</li>
                    ))}
                  </ul>
                )}
                {task.sourceLabel && (
                  <p className="text-xs text-muted-foreground">Source: {task.sourceLabel}</p>
                )}
                {task.clickupUrl && (
                  <a
                    href={task.clickupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View in ClickUp <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Edit mode: save/cancel */}
            {isEditMode && (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                  Save
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Normal mode actions */}
            {!isEditMode && (
              <>
                {/* Folder picker for unresolved tasks */}
                {isPending && !hasList && (
                  <FolderPicker
                    clientDomain={task.clientDomain}
                    clientName={task.clientName}
                    inferredOrg={task.inferredOrg}
                    onSelect={handleAssign}
                  />
                )}

                {/* Push button for resolved tasks */}
                {isPending && hasList && (
                  <button
                    onClick={() => setShowPush(true)}
                    className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    title={`Push to ${task.clickupFolderName}`}
                  >
                    <ArrowUpToLine className="h-3 w-3" />
                    Push
                  </button>
                )}

                {/* Edit button */}
                {isPending && (
                  <button
                    onClick={handleStartEdit}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Dismiss button */}
                {isPending && (
                  <button
                    onClick={handleDismiss}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                    title="Dismiss"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}

                {/* Expand toggle */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : task.objectId)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <PushConfirmDialog
        open={showPush}
        onClose={() => setShowPush(false)}
        tasks={[task]}
      />

      {task.meetingId && (
        <MeetingContextPanel
          meetingId={task.meetingId}
          open={showMeeting}
          onClose={() => setShowMeeting(false)}
        />
      )}
    </>
  );
}
