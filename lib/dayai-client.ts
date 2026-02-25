// Day.ai REST API client for fetching actions
// Uses the same underlying API that the Day.ai MCP server wraps

const DAYAI_API_URL = 'https://api.day.ai/v1';

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

interface SearchResult {
  objects: DayAiAction[];
  totalCount: number;
  hasMore: boolean;
}

function getToken(): string {
  const token = process.env.DAYAI_API_TOKEN;
  if (!token) throw new Error('DAYAI_API_TOKEN environment variable is required');
  return token;
}

export async function fetchActions(): Promise<DayAiAction[]> {
  const token = getToken();
  const actions: DayAiAction[] = [];

  // Fetch actions with different statuses
  for (const status of ['UNREAD', 'READ', 'IN_PROGRESS']) {
    try {
      const res = await fetch(`${DAYAI_API_URL}/objects/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          objectType: 'native_action',
          filter: {
            propertyFilters: [
              { property: 'status', operator: 'eq', value: status },
            ],
          },
          includeRelationships: true,
          limit: 100,
        }),
      });

      if (!res.ok) {
        console.error(`Day.ai fetch failed for status ${status}: ${res.status}`);
        continue;
      }

      const data: SearchResult = await res.json();
      actions.push(...data.objects);
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
