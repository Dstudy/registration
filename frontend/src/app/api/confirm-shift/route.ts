import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/dashboard?confirmed=false', request.url));
  }

  try {
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:3001';
    const res = await fetch(`${backendUrl}/api/registrations/confirm?token=${encodeURIComponent(token)}`, {
      method: 'GET',
    });

    if (res.ok) {
      return NextResponse.redirect(new URL('/dashboard?confirmed=true', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard?confirmed=false', request.url));
  } catch {
    return NextResponse.redirect(new URL('/dashboard?confirmed=false', request.url));
  }
}
