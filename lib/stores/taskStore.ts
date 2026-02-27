import { create } from 'zustand';
import type { EnrichedTask, TaskFilters, TaskStats, PushResult, FolderOption, AssignRequest, TaskEditRequest } from '@/lib/types/task';

interface TaskState {
  tasks: EnrichedTask[];
  refreshedAt: string | null;
  stats: TaskStats;
  selectedIds: Set<string>;
  expandedId: string | null;
  editingId: string | null;
  filters: TaskFilters;
  isLoading: boolean;
  isPushing: boolean;
  error: string | null;
  folders: FolderOption[];
  foldersLoaded: boolean;

  fetchTasks: () => Promise<void>;
  fetchFolders: () => Promise<void>;
  pushTasks: (taskIds: string[]) => Promise<PushResult[]>;
  dismissTasks: (taskIds: string[]) => Promise<void>;
  assignFolder: (req: AssignRequest) => Promise<boolean>;
  editTask: (taskId: string, edits: TaskEditRequest) => Promise<boolean>;
  toggleSelect: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  setExpanded: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  setFilter: (key: keyof TaskFilters, value: string | null) => void;
  clearFilters: () => void;
}

const defaultFilters: TaskFilters = {
  client: null,
  priority: null,
  status: null,
  sourceType: null,
  search: '',
  overdue: false,
  dateRange: '7d',
  showFiltered: false,
  sortField: 'date',
  sortDirection: 'desc',
  groupMode: 'meeting',
};

const defaultStats: TaskStats = {
  total: 0,
  pending: 0,
  pushed: 0,
  dismissed: 0,
  unresolvedClient: 0,
  overdue: 0,
  unresolvedByDomain: {},
};

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  refreshedAt: null,
  stats: defaultStats,
  selectedIds: new Set(),
  expandedId: null,
  editingId: null,
  filters: { ...defaultFilters },
  isLoading: false,
  isPushing: false,
  error: null,
  folders: [],
  foldersLoaded: false,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      set({
        tasks: data.tasks,
        refreshedAt: data.refreshedAt,
        stats: data.stats,
        isLoading: false,
      });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  pushTasks: async (taskIds: string[]) => {
    set({ isPushing: true, error: null });
    try {
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds }),
      });
      if (!res.ok) throw new Error('Push failed');
      const data = await res.json();
      // Refresh tasks to get updated statuses
      await get().fetchTasks();
      set({ isPushing: false, selectedIds: new Set() });
      return data.results as PushResult[];
    } catch (err) {
      set({ error: (err as Error).message, isPushing: false });
      return [];
    }
  },

  dismissTasks: async (taskIds: string[]) => {
    try {
      const res = await fetch('/api/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskIds }),
      });
      if (!res.ok) throw new Error('Dismiss failed');
      await get().fetchTasks();
      set({ selectedIds: new Set() });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  fetchFolders: async () => {
    if (get().foldersLoaded) return;
    try {
      const res = await fetch('/api/folders');
      if (!res.ok) throw new Error('Failed to fetch folders');
      const data = await res.json();
      set({ folders: data.folders, foldersLoaded: true });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  assignFolder: async (req: AssignRequest) => {
    try {
      const res = await fetch('/api/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error('Assign failed');
      await get().fetchTasks();
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  editTask: async (taskId: string, edits: TaskEditRequest) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edits),
      });
      if (!res.ok) throw new Error('Edit failed');
      await get().fetchTasks();
      set({ editingId: null });
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  toggleSelect: (id: string) => {
    const s = new Set(get().selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    set({ selectedIds: s });
  },

  selectAll: (ids: string[]) => set({ selectedIds: new Set(ids) }),
  deselectAll: () => set({ selectedIds: new Set() }),
  setExpanded: (expandedId) => set({ expandedId }),
  setEditing: (editingId) => set({ editingId }),

  setFilter: (key, value) => {
    const update: Record<string, unknown> = { [key]: value };
    // Handle boolean filters
    if (key === 'overdue' || key === 'showFiltered') {
      update[key] = !!value;
    }
    set({ filters: { ...get().filters, ...update } as TaskFilters });
  },

  clearFilters: () => set({ filters: { ...defaultFilters } }),
}));
