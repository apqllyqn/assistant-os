import { NextResponse } from 'next/server';
import { refreshTasks, isRateLimited, secondsUntilNextRefresh } from '@/lib/refresh';

export async function POST() {
  try {
    if (isRateLimited()) {
      const wait = secondsUntilNextRefresh();
      return NextResponse.json(
        { message: `Refreshed recently — try again in ${wait}s`, retryAfter: wait },
        { status: 429 }
      );
    }

    const result = await refreshTasks();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Refresh failed:', err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
