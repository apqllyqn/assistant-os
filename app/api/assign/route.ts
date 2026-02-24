import { NextRequest, NextResponse } from 'next/server';
import { assignTaskFolder } from '@/lib/api/tasks';
import type { AssignRequest } from '@/lib/types/task';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AssignRequest;

    if (!body.taskId || !body.listId || !body.folderId) {
      return NextResponse.json(
        { error: 'taskId, listId, and folderId are required' },
        { status: 400 }
      );
    }

    const task = await assignTaskFolder(
      body.taskId,
      body.listId,
      body.folderId,
      body.folderName,
      body.spaceName,
    );

    return NextResponse.json({ success: true, task });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
