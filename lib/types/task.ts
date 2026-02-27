export interface Task {
  objectId: string;
  title: string;
  description: string;
  descriptionPoints: string[];
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceLabel: string | null;
  people: string[];
  domains: string[];
  clientDomain: string | null;
  clientName: string | null;
  clickupListId: string | null;
  clickupFolderName: string | null;
  clickupSpaceName: string | null;
  reasoning: string | null;
  unbundledFrom: string | null;
  meetingDate: string | null;
  createdAt: string | null;
  meetingId: string | null;
  meetingTitle: string | null;
  meetingAttendees: string[];
  isFiltered: boolean;
}

export interface EnrichedTask extends Task {
  syncStatus: 'pending' | 'pushed' | 'dismissed';
  clickupTaskId?: string;
  clickupUrl?: string;
  syncedAt?: string;
  inferredOrg?: string | null;
}

export interface TasksFile {
  version: 1;
  refreshedAt: string | null;
  tasks: Task[];
  dismissed: string[];
}

export interface SyncEntry {
  clickupTaskId: string;
  clickupUrl: string;
  clickupListId: string;
  clientDomain: string;
  clientName: string;
  syncedAt: string;
  title: string;
}

export type SyncLedger = Record<string, SyncEntry>;

export interface ClientEntry {
  name: string;
  folderId: string;
  listId: string;
  listName: string;
  space: string;
}

export interface ClientMap {
  workspaceId: string;
  clickupApiToken: string;
  ownDomain: string;
  defaultSpace: string;
  defaultSpaceId: string;
  clients: Record<string, ClientEntry>;
  spaces: Record<string, { id: string; folders: Record<string, string> }>;
}

export type SortField = 'date' | 'priority' | 'client';
export type SortDirection = 'asc' | 'desc';
export type GroupMode = 'meeting' | 'client' | 'none';
export type DateRange = 'today' | '7d' | '30d' | 'all';

export interface TaskFilters {
  client: string | null;
  priority: string | null;
  status: string | null;
  sourceType: string | null;
  search: string;
  overdue: boolean;
  dateRange: DateRange;
  showFiltered: boolean;
  sortField: SortField;
  sortDirection: SortDirection;
  groupMode: GroupMode;
}

export interface TaskStats {
  total: number;
  pending: number;
  pushed: number;
  dismissed: number;
  unresolvedClient: number;
  overdue: number;
  unresolvedByDomain: Record<string, number>;
}

export interface PushResult {
  taskId: string;
  success: boolean;
  clickupUrl?: string;
  clickupTaskId?: string;
  error?: string;
}

export interface FolderOption {
  listId: string | null;
  folderId: string;
  folderName: string;
  spaceName: string;
  listName: string | null;
  displayLabel: string;
}

export interface AssignRequest {
  taskId: string;
  listId: string;
  folderId: string;
  folderName: string;
  spaceName: string;
}

export interface TaskEditRequest {
  title?: string;
  priority?: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  dueDate?: string | null;
}
