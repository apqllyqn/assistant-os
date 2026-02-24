import { NextRequest, NextResponse } from 'next/server';
import { editTask } from '@/lib/api/tasks';
import type { TaskEditRequest } from '@/lib/types/task';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as TaskEditRequest;

    if (!body.title && !body.priority && body.dueDate === undefined) {
      return NextResponse.json(
        { error: 'At least one field (title, priority, dueDate) is required' },
        { status: 400 }
      );
    }

    const task = await editTask(id, body);
    return NextResponse.json({ success: true, task });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
