import { NextResponse } from 'next/server'

// Legacy SSE endpoint — deprecated in Vercel serverless deployment.
// Redirects to polling endpoint. Client should use /api/xau/poll instead.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json(
    {
      error: 'SSE deprecated on serverless. Use /api/xau/poll instead.',
      pollEndpoint: '/api/xau/poll',
      pollIntervalMs: 2000,
    },
    { status: 410 },
  )
}
