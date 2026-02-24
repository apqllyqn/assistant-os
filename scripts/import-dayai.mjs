#!/usr/bin/env node
/**
 * Transform raw Day.ai action exports into tasks.json format.
 * Usage: node scripts/import-dayai.mjs < data/raw-actions.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

// Read client map
const clientMap = JSON.parse(readFileSync(join(DATA_DIR, 'client-map.json'), 'utf-8'));

// Read raw actions from stdin or file arg
const rawPath = process.argv[2] || join(DATA_DIR, 'raw-actions.json');
const rawActions = JSON.parse(readFileSync(rawPath, 'utf-8'));

function safeParse(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

function resolveClient(domains, relationships) {
  // Filter out own domain
  const external = domains.filter(d => d !== 'hirecharm.com' && d !== 'krishnapryor.com');

  // Try direct match from client map
  for (const d of external) {
    if (clientMap.clients[d]) {
      return { domain: d, ...clientMap.clients[d] };
    }
  }

  // Try fuzzy: check org relationships
  if (relationships) {
    for (const rel of relationships) {
      if (rel.relationship === 'is for organization' && rel.objectId !== 'hirecharm.com' && rel.objectId !== 'krishnapryor.com') {
        const orgDomain = rel.objectId;
        if (clientMap.clients[orgDomain]) {
          return { domain: orgDomain, ...clientMap.clients[orgDomain] };
        }
        // Fuzzy match org title against folder names
        const orgTitle = (rel.title || '').toLowerCase();
        for (const [spaceName, space] of Object.entries(clientMap.spaces)) {
          for (const [folderName, folderId] of Object.entries(space.folders)) {
            if (orgTitle.includes(folderName.toLowerCase()) || folderName.toLowerCase().includes(orgTitle)) {
              // Found a fuzzy match - return with domain but no listId
              return {
                domain: orgDomain,
                name: folderName,
                folderId,
                listId: null,
                listName: null,
                space: spaceName,
              };
            }
          }
        }
      }
    }
  }

  // No match - return first external domain if any
  if (external.length > 0) {
    return { domain: external[0], name: null, folderId: null, listId: null, listName: null, space: null };
  }

  return null;
}

function extractMeetingDate(props) {
  if (props.sourceType === 'MEETING_RECORDING' && props.assignedAt) {
    return props.assignedAt.split('T')[0];
  }
  return null;
}

const tasks = rawActions.map(action => {
  const props = action.properties || {};
  const domains = safeParse(props.domains);
  const people = safeParse(props.people);
  const descriptionPoints = safeParse(props.descriptionPoints);

  const client = resolveClient(domains, action.relationships);

  return {
    objectId: action.objectId,
    title: props.title || action.title,
    description: props.description || action.description || '',
    descriptionPoints,
    priority: props.priority || 'MEDIUM',
    dueDate: null,
    sourceType: props.type || props.sourceType || 'OTHER',
    sourceId: props.sourceId || null,
    sourceLabel: props.sourceLabel || null,
    people,
    domains,
    clientDomain: client?.domain || null,
    clientName: client?.name || null,
    clickupListId: client?.listId || null,
    clickupFolderName: client?.name || null,
    clickupSpaceName: client?.space || null,
    unbundledFrom: null,
    meetingDate: extractMeetingDate(props),
  };
});

const output = {
  version: 1,
  refreshedAt: new Date().toISOString(),
  tasks,
  dismissed: [],
};

writeFileSync(join(DATA_DIR, 'tasks.json'), JSON.stringify(output, null, 2));
console.log(`Wrote ${tasks.length} tasks to data/tasks.json`);

// Print summary
const withClient = tasks.filter(t => t.clientName);
const withoutClient = tasks.filter(t => !t.clientName);
const withClickup = tasks.filter(t => t.clickupListId);
console.log(`  ${withClient.length} matched to a client`);
console.log(`  ${withClickup.length} have ClickUp list IDs`);
console.log(`  ${withoutClient.length} unresolved (no client match)`);

// List unresolved
if (withoutClient.length > 0) {
  console.log('\nUnresolved tasks:');
  for (const t of withoutClient) {
    console.log(`  - ${t.title} [${t.domains.join(', ') || 'no domain'}]`);
  }
}
