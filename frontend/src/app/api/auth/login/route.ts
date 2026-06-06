import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001';

function forwardCookies(backendRes: Response, response: NextResponse) {
  const cookies =
    typeof (backendRes.headers as any).getSetCookie === 'function'
      ? (backendRes.headers as any).getSetCookie()
      : [];

  if (cookies.length > 0) {
    cookies.forEach((c: string) => response.headers.append('Set-Cookie', c));
  } else {
    // Fallback for runtimes without getSetCookie
    backendRes.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        response.headers.append('Set-Cookie', value);
      }
    });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const backendRes = await fetch(`${BACKEND}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await backendRes.json();

  if (!backendRes.ok) {
    return NextResponse.json(data, { status: backendRes.status });
  }

  const response = NextResponse.json(data, { status: backendRes.status });
  forwardCookies(backendRes, response);
  return response;
}
