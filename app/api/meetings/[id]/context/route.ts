import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { fetchMeetingContext } from '@/lib/dayai-client';
import type { MeetingContext } from '@/lib/dayai-client';

const CACHE_FILE = path.join(process.cwd(), 'data', 'meetings-cache.json');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type MeetingsCache = Record<string, MeetingContext>;

async function readCache(): Promise<MeetingsCache> {
  try {
    const raw = await fs.readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeCache(cache: MeetingsCache): Promise<void> {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Check cache first
  const cache = await readCache();
  const cached = cache[id];
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
    return NextResponse.json(cached);
  }

  // Fetch from Day.ai
  const context = await fetchMeetingContext(id);
  if (!context) {
    return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
  }

  // Cache it
  cache[id] = context;
  await writeCache(cache);

  return NextResponse.json(context);
}
