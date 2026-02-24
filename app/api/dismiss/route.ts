import { NextRequest, NextResponse } from 'next/server';
import { dismissTasks } from '@/lib/api/tasks';

export async function POST(request: NextRequest) {
  try {
    const { taskIds } = (await request.json()) as { taskIds: string[] };

    if (!taskIds || taskIds.length === 0) {
      return NextResponse.json({ error: 'No task IDs provided' }, { status: 400 });
    }

    await dismissTasks(taskIds);

    return NextResponse.json({ success: true, dismissed: taskIds.length });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
