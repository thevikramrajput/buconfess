import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== 'string') return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    if (text.trim().length < 10) return NextResponse.json({ error: 'Confession too short' }, { status: 400 });
    if (text.length > 2000) return NextResponse.json({ error: 'Confession too long' }, { status: 400 });
    const confession = await prisma.confession.create({ data: { text: text.trim() } });
    return NextResponse.json({ success: true, id: confession.id });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const isAdmin = await getAdminFromRequest();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'pending';
  const confessions = await prisma.confession.findMany({
    where: { status },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(confessions);
}
