import { NextResponse } from 'next/server';
import { needsConsent } from '@/lib/signup-source';

export function GET(request: Request) {
  return NextResponse.json(
    { automatic: !needsConsent(request.headers.get('x-vercel-ip-country')) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
