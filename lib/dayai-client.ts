// Day.ai MCP client for fetching actions
// Uses Day.ai's MCP endpoint with OAuth PKCE refresh tokens

const DAYAI_BASE_URL = 'https://day.ai';
const DAYAI_MCP_URL = `${DAYAI_BASE_URL}/api/mcp`;
const DAYAI_TOKEN_URL = `${DAYAI_BASE_URL}/api/oauth`;

interface DayAiAction {
  objectId: string;
  title: string;
  body: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  properties: Record<string, unknown>;
  relationships?: Array<{
    targetObjectId: string;
    targetObjectType: string;
    relationshipType: string;
    targetObjectProperties?: Record<string, unknown>;
  }>;
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

export async function fetchActions(): Promise<DayAiAction[]> {
  const actions: DayAiAction[] = [];

  for (const status of ['UNREAD', 'READ', 'IN_PROGRESS']) {
    try {
      const data = await mcpCall('search_objects', {
        queries: [{
          objectType: 'native_action',
          filter: {
            propertyFilters: [
              { property: 'status', operator: 'eq', value: status },
            ],
          },
          includeRelationships: true,
          limit: 100,
        }],
      }) as Record<string, unknown>;

      const results = (data?.native_action as Record<string, unknown>)?.results as Array<Record<string, unknown>> ?? [];

      for (const r of results) {
        actions.push({
          objectId: r.objectId as string,
          title: r.title as string || '',
          body: r.description as string || '',
          type: r.type as string || '',
          status: status,
          createdAt: r.createdAt as string || '',
          updatedAt: r.updatedAt as string || '',
          properties: r.properties as Record<string, unknown> || {},
          relationships: r.relationships as DayAiAction['relationships'],
        });
      }
    } catch (err) {
      console.error(`Day.ai fetch error for status ${status}:`, err);
    }
  }

  return actions;
}

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
  unbundledFrom: string | null;
  meetingDate: string | null;
  createdAt: string;
} {
  // Extract description points from body
  const body = (action.body || '').trim();
  const points = body.split('\n').filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*'))
    .map((l) => l.trim().replace(/^[-*]\s*/, ''));

  // Extract people from relationships
  const people: string[] = [];
  const domains: string[] = [];
  let clientDomain: string | null = null;
  let clientName: string | null = null;

  if (action.relationships) {
    for (const rel of action.relationships) {
      if (rel.targetObjectType === 'native_contact') {
        const name = rel.targetObjectProperties?.name as string | undefined;
        if (name) people.push(name);
        // Extract domain from email
        const email = rel.targetObjectId;
        if (email?.includes('@')) {
          const domain = email.split('@')[1];
          if (domain && domain !== ownDomain && !domains.includes(domain)) {
            domains.push(domain);
          }
        }
      }
      if (rel.targetObjectType === 'native_organization') {
        const orgDomain = rel.targetObjectId;
        if (orgDomain && orgDomain !== ownDomain) {
          clientDomain = orgDomain;
          clientName = (rel.targetObjectProperties?.name as string) || orgDomain.split('.')[0];
        }
      }
    }
  }

  // Fallback: pick first external domain as client
  if (!clientDomain && domains.length > 0) {
    clientDomain = domains[0];
    clientName = clientDomain.split('.')[0];
    // Capitalize first letter
    clientName = clientName.charAt(0).toUpperCase() + clientName.slice(1);
  }

  // Determine source type from action type
  const typeMap: Record<string, string> = {
    'meeting_followup': 'MEETING_RECORDING_FOLLOWUP',
    'email_response': 'EMAIL_RESPONSE',
    'support': 'SUPPORT',
    'followup': 'FOLLOWUP',
    'schedule_meeting': 'SCHEDULE_MEETING',
  };
  const sourceType = typeMap[action.type?.toLowerCase()] || action.type?.toUpperCase() || 'OTHER';

  return {
    objectId: action.objectId,
    title: action.title || 'Untitled action',
    description: body,
    descriptionPoints: points,
    priority: 'MEDIUM',
    dueDate: null,
    sourceType,
    sourceId: action.objectId,
    sourceLabel: action.properties?.sourceLabel as string || null,
    people,
    domains,
    clientDomain,
    clientName,
    unbundledFrom: null,
    meetingDate: action.properties?.meetingDate as string || null,
    createdAt: action.createdAt,
  };
}
