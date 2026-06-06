import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value;

  await fetch(`${BACKEND}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Cookie: accessToken ? `access_token=${accessToken}` : '',
    },
  }).catch(() => {});

  const response = NextResponse.json({ message: 'Đăng xuất thành công' });

  // Clear cookies on the browser side
  const cookieOpts = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  response.headers.append('Set-Cookie', `access_token=; ${cookieOpts}`);
  response.headers.append('Set-Cookie', `refresh_token=; ${cookieOpts}`);

  return response;
}
