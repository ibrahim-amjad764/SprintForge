import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import logger from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Readiness probe — reports whether the app can serve real traffic.
// Currently checks the Mongoose connection state without forcing a
// new connection attempt (connectDB owns connection lifecycle).
//
// readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
export async function GET() {
  const readyState = mongoose.connection.readyState;
  const isReady = readyState === 1;

  if (!isReady) {
    logger.warn({ readyState }, 'Readiness probe: database not connected');
  }

  return NextResponse.json(
    {
      status: isReady ? 'ready' : 'not_ready',
      checks: {
        database: isReady ? 'up' : 'down',
      },
      timestamp: new Date().toISOString(),
    },
    { status: isReady ? 200 : 503 }
  );
}
