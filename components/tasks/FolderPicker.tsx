'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { FolderOpen, Search, ChevronDown, Star, Plus } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { fuzzyMatch } from '@/lib/fuzzy-match';
import { toast } from 'sonner';
import type { FolderOption } from '@/lib/types/task';

interface FolderPickerProps {
  clientDomain?: string | null;
  clientName?: string | null;
  inferredOrg?: string | null;
  onSelect: (folder: FolderOption) => void;
}

export function FolderPicker({ clientDomain, clientName, inferredOrg, onSelect }: FolderPickerProps) {
  const { folders, foldersLoaded, fetchFolders } = useTaskStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Match hint: try clientName, then domain prefix, then inferred org
  const matchHint = clientName || clientDomain?.split('.')[0] || inferredOrg || '';

  const { suggested, rest } = useMemo(() => {
    // Filter by search text first
    let list = folders;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.displayLabel.toLowerCase().includes(q));
    }

    if (!matchHint) return { suggested: [], rest: list };

    // Build target strings: folder name + all known client names
    const targets = list.map((f) => f.folderName);
    const matches = fuzzyMatch(matchHint, targets, 0.2);

    const suggestedIndices = new Set(matches.slice(0, 5).map((m) => m.index));
    const suggested = list.filter((_, i) => suggestedIndices.has(i));
    const rest = list.filter((_, i) => !suggestedIndices.has(i));

    return { suggested, rest };
  }, [folders, search, matchHint]);

  const handleCreateClient = (folder: FolderOption) => {
    if (!folder.listId) {
      toast.error('This folder has no list ID configured');
      return;
    }
    onSelect(folder);
    setOpen(false);
    setShowCreate(false);
    setSearch('');
  };

  if (!foldersLoaded) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <FolderOpen className="h-3 w-3 animate-pulse" />
        Loading...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-dashed border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
      >
        <FolderOpen className="h-3 w-3" />
        Assign folder
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-lg border bg-popover shadow-lg">
          {/* Search */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search folders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Options */}
          <div className="max-h-64 overflow-y-auto p-1">
            {suggested.length > 0 && (
              <>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3 text-orange-400" />
                  Suggested for &ldquo;{matchHint}&rdquo;
                </div>
                {suggested.map((f) => (
                  <FolderItem
                    key={`s-${f.folderId}`}
                    folder={f}
                    highlighted
                    onSelect={() => { onSelect(f); setOpen(false); setSearch(''); }}
                  />
                ))}
                <div className="my-1 border-t" />
              </>
            )}

            {rest.length > 0 ? (
              rest.map((f) => (
                <FolderItem
                  key={f.folderId}
                  folder={f}
                  onSelect={() => { onSelect(f); setOpen(false); setSearch(''); }}
                />
              ))
            ) : suggested.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No folders found
              </div>
            ) : null}
          </div>

          {/* Create New Client */}
          <div className="border-t p-2">
            {!showCreate ? (
              <button
                onClick={() => {
                  setShowCreate(true);
                  setNewClientName(clientName || inferredOrg || clientDomain?.split('.')[0] || '');
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Create new client mapping
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Client name"
                  className="w-full rounded border bg-background px-2 py-1 text-sm"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Pick a folder above to map this client</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FolderItem({
  folder,
  highlighted,
  onSelect,
}: {
  folder: FolderOption;
  highlighted?: boolean;
  onSelect: () => void;
}) {
  const hasListId = !!folder.listId;

  return (
    <button
      onClick={hasListId ? onSelect : undefined}
      disabled={!hasListId}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
        hasListId && 'hover:bg-accent cursor-pointer',
        !hasListId && 'opacity-50 cursor-not-allowed',
        highlighted && 'bg-orange-50',
      )}
      title={hasListId ? `Assign to ${folder.displayLabel}` : 'No list ID — needs setup'}
    >
      <FolderOpen className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{folder.folderName}</div>
        <div className="truncate text-xs text-muted-foreground">{folder.spaceName}</div>
      </div>
    </button>
  );
}
