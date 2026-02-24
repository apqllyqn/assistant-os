import { NextResponse } from 'next/server';
import { getFolderOptions } from '@/lib/api/tasks';

export async function GET() {
  try {
    const folders = await getFolderOptions();
    return NextResponse.json({ folders });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
