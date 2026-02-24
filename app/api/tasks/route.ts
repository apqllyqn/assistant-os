import { NextResponse } from 'next/server';
import { getEnrichedTasks } from '@/lib/api/tasks';

export async function GET() {
  try {
    const data = await getEnrichedTasks();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
