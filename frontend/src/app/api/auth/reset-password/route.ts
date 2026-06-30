import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3001';
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Dữ liệu không hợp lệ' }, { status: 400 });
  }

  const backendRes = await fetch(`${BACKEND}/api/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await backendRes.text();
  const data = text ? JSON.parse(text) : null;

  return NextResponse.json(data, { status: backendRes.status });
}
