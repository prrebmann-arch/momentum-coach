// Backwards compatibility — old webhook path
// Must be a full handler, not a re-export (re-exports cause 308 redirects on Vercel)
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  // Forward to the real webhook handler by importing and calling it
  const { POST: realHandler } = await import('@/app/api/stripe/webhook/route')
  return realHandler(request)
}
