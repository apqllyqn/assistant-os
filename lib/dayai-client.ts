// Day.ai MCP client for fetching actions
// Uses Day.ai's MCP endpoint with OAuth PKCE refresh tokens

const DAYAI_BASE_URL = 'https://day.ai';
const DAYAI_MCP_URL = `${DAYAI_BASE_URL}/api/mcp`;
const DAYAI_TOKEN_URL = `${DAYAI_BASE_URL}/api/oauth`;

interface DayAiRelationship {
  objectType: string;
  objectId: string;
  title: string;
  description: string;
  relationship: string;
}

interface DayAiAction {
  objectId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, string>;
  relationships?: DayAiRelationship[];
}

// OAuth token cache
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (60s buffer)
  if (cachedAccessToken && tokenExpiresAt > Date.now() + 60_000) {
    return cachedAccessToken;
  }

  const clientId = process.env.DAYAI_CLIENT_ID;
  const refreshToken = process.env.DAYAI_REFRESH_TOKEN;
  if (!clientId || !refreshToken) {
    throw new Error('DAYAI_CLIENT_ID and DAYAI_REFRESH_TOKEN environment variables are required');
  }

  const res = await fetch(DAYAI_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Day.ai token refresh failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3300) * 1000;
  return cachedAccessToken!;
}

async function mcpCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(DAYAI_MCP_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    }),
  });

  if (!res.ok) {
    throw new Error(`Day.ai MCP call failed (${res.status})`);
  }

  const rpc = await res.json();
  if (rpc.error) {
    throw new Error(`Day.ai MCP error: ${rpc.error.message}`);
  }

  const text = rpc.result?.content?.[0]?.text;
  return text ? JSON.parse(text) : null;
}

// Meeting recording type
export interface DayAiMeeting {
  objectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  attendees: string[]; // email addresses
}

// Meeting context (fetched lazily)
export interface MeetingContext {
  meetingId: string;
  title: string;
  summary: string;
  notes: string;
  attendees: string[];
  createdAt: string;
  fetchedAt: string;
}

export async function fetchMeetings(daysBack: number = 7): Promise<DayAiMeeting[]> {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();
  try {
    const data = await mcpCall('search_objects', {
      queries: [{
        objectType: 'native_meetingrecording',
        timeframeStart: since,
        includeRelationships: true,
        limit: 50,
      }],
    }) as Record<string, unknown>;

    const results = (data?.native_meetingrecording as Record<string, unknown>)?.results as Array<Record<string, unknown>> ?? [];

    return results.map((r) => {
      const attendees: string[] = [];
      const rels = r.relationships as Array<Record<string, unknown>> | undefined;
      if (rels) {
        for (const rel of rels) {
          if (rel.targetObjectType === 'native_contact' && typeof rel.targetObjectId === 'string') {
            attendees.push(rel.targetObjectId);
          }
        }
      }
      return {
        objectId: r.objectId as string,
        title: r.title as string || '',
        createdAt: r.createdAt as string || '',
        updatedAt: r.updatedAt as string || '',
        attendees,
      };
    });
  } catch (err) {
    console.error('Day.ai meeting fetch error:', err);
    return [];
  }
}

export async function fetchMeetingContext(meetingId: string): Promise<MeetingContext | null> {
  try {
    const data = await mcpCall('get_meeting_recording_context', {
      meetingRecordingId: meetingId,
    }) as Record<string, unknown>;

    if (!data) return null;

    // Day.ai returns a single contextString with title, participants, transcript
    const contextString = data.contextString as string || '';

    // Parse title from "Title: ..." line
    const titleMatch = contextString.match(/^Title:\s*(.+)$/m);
    const title = titleMatch?.[1] || '';

    // Parse participants from "Participants: ..." line
    const participantsMatch = contextString.match(/^Participants:\s*(.+)$/m);
    const attendees = participantsMatch?.[1]?.split(',').map((s) => s.trim()).filter(Boolean) || [];

    // Extract date from "Stored At: ..." line
    const storedAtMatch = contextString.match(/^Stored At:\s*(.+)$/m);
    const createdAt = storedAtMatch?.[1] || '';

    // Everything after "Transcript:" is the transcript; use the pre-transcript part as summary
    const transcriptIdx = contextString.indexOf('Transcript:');
    const summary = transcriptIdx > 0
      ? contextString.slice(0, transcriptIdx).trim()
      : contextString.slice(0, 500);

    return {
      meetingId,
      title,
      summary,
      notes: contextString,
      attendees,
      createdAt,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`Day.ai meeting context fetch error for ${meetingId}:`, err);
    return null;
  }
}

// Noise filter patterns
const NOISE_TITLE_PATTERNS = [
  /\brecap\b/i,                                    // Any title containing "recap"
  /^Send\s+(meeting\s+notes|summary)/i,            // "Send meeting notes/summary"
  /^Share\s+(meeting\s+notes|summary)/i,            // "Share meeting notes/summary"
  /^.+\s+tasks$/i,                                  // Bucket labels: "Chris Booth tasks", "Joshua tasks"
];

const NOISE_ACTION_TYPES = new Set(['NUDGE', 'SCHEDULE_MEETING']);

export function isNoiseAction(title: string, description: string, actionType?: string): boolean {
  if (NOISE_TITLE_PATTERNS.some((p) => p.test(title))) return true;
  if (description.trim().startsWith('Completed -')) return true;
  if (actionType && NOISE_ACTION_TYPES.has(actionType)) return true;
  // Description mentions sending a meeting recap
  if (/send\s+(a\s+)?meeting\s+recap/i.test(description)) return true;
  return false;
}

export async function fetchActions(daysBack: number = 14): Promise<DayAiAction[]> {
  try {
    const since = new Date(Date.now() - daysBack * 86400000).toISOString();
    const data = await mcpCall('search_objects', {
      queries: [{
        objectType: 'native_action',
        where: {
          propertyId: 'status',
          operator: 'isAnyOf',
          value: ['UNREAD', 'READ', 'IN_PROGRESS'],
        },
        includeRelationships: true,
      }],
      propertiesToReturn: '*',
      timeframeStart: since,
      timeframeField: 'createdAt',
    }) as Record<string, unknown>;

    const results = (data?.native_action as Record<string, unknown>)?.results as Array<Record<string, unknown>> ?? [];

    // Deduplicate by objectId within the batch
    const seen = new Set<string>();
    const actions: DayAiAction[] = [];
    for (const r of results) {
      const id = r.objectId as string;
      if (seen.has(id)) continue;
      seen.add(id);
      actions.push({
        objectId: id,
        title: r.title as string || '',
        description: r.description as string || '',
        createdAt: r.createdAt as string || '',
        updatedAt: r.updatedAt as string || '',
        properties: (r.properties as Record<string, string>) || {},
        relationships: r.relationships as DayAiRelationship[] | undefined,
      });
    }
    return actions;
  } catch (err) {
    console.error('Day.ai fetch actions error:', err);
    return [];
  }
}

// Safe JSON array parser for Day.ai string-encoded arrays
function parseJsonArray(val: unknown): string[] {
  if (!val || typeof val !== 'string') return [];
  try {
    const arr = JSON.parse(val);
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

const VALID_PRIORITIES = new Set(['URGENT', 'HIGH', 'MEDIUM', 'LOW']);

export function transformAction(action: DayAiAction, ownDomain: string): {
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
  reasoning: string | null;
  unbundledFrom: string | null;
  meetingDate: string | null;
  createdAt: string;
  meetingId: string | null;
  meetingTitle: string | null;
  meetingAttendees: string[];
  isFiltered: boolean;
} {
  const props = action.properties;
  const title = action.title || props.title || 'Untitled action';
  const description = (props.description || action.description || '').trim();

  // Use Day.ai's native descriptionPoints (JSON string array) or fall back to parsing
  let descriptionPoints = parseJsonArray(props.descriptionPoints);
  if (descriptionPoints.length === 0 && description) {
    descriptionPoints = description.split('\n')
      .filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*'))
      .map((l) => l.trim().replace(/^[-*]\s*/, ''));
  }

  // Use Day.ai's native priority
  const rawPriority = (props.priority || '').toUpperCase();
  const priority = VALID_PRIORITIES.has(rawPriority)
    ? rawPriority as 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW'
    : 'MEDIUM';

  // Use Day.ai's sourceType and sourceId directly
  const sourceType = props.sourceType || props.type || 'OTHER';
  const sourceId = props.sourceId || null;
  const sourceLabel = props.sourceLabel || null;
  const reasoning = props.reasoning || null;
  const actionType = props.type || '';

  // Meeting linking: if source is a meeting recording, use sourceId as meetingId
  const isMeetingSource = sourceType === 'MEETING_RECORDING';
  const meetingId = isMeetingSource && sourceId ? sourceId : null;
  const meetingTitle = isMeetingSource && sourceLabel ? sourceLabel : null;

  // Extract people and domains from relationships
  const people: string[] = [];
  const domains: string[] = [];
  let clientDomain: string | null = null;
  let clientName: string | null = null;

  if (action.relationships) {
    for (const rel of action.relationships) {
      if (rel.objectType === 'native_contact') {
        if (rel.title) people.push(rel.title);
        const email = rel.objectId;
        if (email?.includes('@')) {
          const domain = email.split('@')[1];
          if (domain && domain !== ownDomain && !domains.includes(domain)) {
            domains.push(domain);
          }
        }
      }
      if (rel.objectType === 'native_organization') {
        const orgDomain = rel.objectId;
        if (orgDomain && orgDomain !== ownDomain) {
          clientDomain = orgDomain;
          clientName = rel.title || orgDomain.split('.')[0];
        }
      }
    }
  }

  // Also parse people/domains from properties as fallback
  if (people.length === 0) {
    const propPeople = parseJsonArray(props.people);
    for (const email of propPeople) {
      if (email.includes('@')) {
        const domain = email.split('@')[1];
        if (domain && domain !== ownDomain && !domains.includes(domain)) {
          domains.push(domain);
        }
      }
    }
  }
  if (!clientDomain) {
    const propDomains = parseJsonArray(props.domains);
    const external = propDomains.find((d) => d !== ownDomain);
    if (external) {
      clientDomain = external;
      clientName = external.split('.')[0];
      clientName = clientName.charAt(0).toUpperCase() + clientName.slice(1);
    }
  }

  // Fallback: pick first external domain as client
  if (!clientDomain && domains.length > 0) {
    clientDomain = domains[0];
    clientName = clientDomain.split('.')[0];
    clientName = clientName.charAt(0).toUpperCase() + clientName.slice(1);
  }

  return {
    objectId: action.objectId,
    title,
    description,
    descriptionPoints,
    priority,
    dueDate: null,
    sourceType,
    sourceId,
    sourceLabel,
    people,
    domains,
    clientDomain,
    clientName,
    reasoning,
    unbundledFrom: null,
    meetingDate: action.createdAt || null,
    createdAt: action.createdAt,
    meetingId,
    meetingTitle,
    meetingAttendees: [],
    isFiltered: isNoiseAction(title, description, actionType),
  };
}
