'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { FolderOpen, Search, ChevronDown, Star } from 'lucide-react';
import { useTaskStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import type { FolderOption } from '@/lib/types/task';

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  const t = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!q || !t) return 100;
  if (t === q) return 0;
  if (t.includes(q)) return 1;
  if (q.includes(t)) return 2;
  return levenshtein(q, t);
}

interface FolderPickerProps {
  clientDomain?: string | null;
  clientName?: string | null;
  onSelect: (folder: FolderOption) => void;
}

export function FolderPicker({ clientDomain, clientName, onSelect }: FolderPickerProps) {
  const { folders, foldersLoaded, fetchFolders } = useTaskStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
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
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const matchHint = clientName || clientDomain?.split('.')[0] || '';

  const { suggested, rest } = useMemo(() => {
    // Filter by search text
    let list = folders;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.displayLabel.toLowerCase().includes(q));
    }

    if (!matchHint) return { suggested: [], rest: list };

    // Score and sort
    const scored = list.map((f) => ({
      folder: f,
      score: fuzzyScore(matchHint, f.folderName),
    }));
    scored.sort((a, b) => a.score - b.score);

    const suggested = scored.filter((s) => s.score <= 3).map((s) => s.folder);
    const rest = scored.filter((s) => s.score > 3).map((s) => s.folder);

    return { suggested, rest };
  }, [folders, search, matchHint]);

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
        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border bg-popover shadow-lg">
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
                  Suggested
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
