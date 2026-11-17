import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Liveness probe — the process is up and serving requests.
// No dependency checks; intentionally minimal and cheap enough
// to be hit frequently by orchestrators.
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
