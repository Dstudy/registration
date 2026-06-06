import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';

function applyBackendCookies(backendRes: Response, response: NextResponse) {
  const raw: string[] =
    typeof (backendRes.headers as any).getSetCookie === 'function'
      ? (backendRes.headers as any).getSetCookie()
      : [];

  for (const cookie of raw) {
    const [nameValue, ...directives] = cookie.split(/;\s*/);
    const eq = nameValue.indexOf('=');
    if (eq === -1) continue;

    const name = nameValue.slice(0, eq).trim();
    const value = nameValue.slice(eq + 1).trim();

    const opts: Parameters<typeof response.cookies.set>[2] = {};
    for (const d of directives) {
      const lower = d.toLowerCase().trim();
      if (lower === 'httponly') opts.httpOnly = true;
      else if (lower === 'secure') opts.secure = true;
      else if (lower.startsWith('samesite='))
        opts.sameSite = d.split('=')[1].toLowerCase() as 'lax' | 'strict' | 'none';
      else if (lower.startsWith('max-age='))
        opts.maxAge = parseInt(d.split('=')[1], 10);
      else if (lower.startsWith('path=')) opts.path = d.split('=')[1];
    }

    response.cookies.set(name, value, opts);
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
  applyBackendCookies(backendRes, response);
  return response;
}
