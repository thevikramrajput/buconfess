import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const isAdmin = await getAdminFromRequest();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'MAKE_WEBHOOK_URL not configured in Railway variables.' },
      { status: 500 }
    );
  }

  const { id } = await req.json();
  const confession = await prisma.confession.findUnique({ where: { id } });
  if (!confession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://buconfess-production.up.railway.app';
  const parts: string[] = confession.parts ? JSON.parse(confession.parts) : [confession.text];
  const handle = process.env.IG_HANDLE || '@bu.confess';
  const prefix = process.env.IG_CAPTION_PREFIX || '';
  const caption = `${prefix}Confession #${confession.number}\n\nDM or visit the link in bio to submit yours!\n\n${handle}`;
  const imageUrls = parts.map((_: string, i: number) => `${appUrl}/api/image/${id}/${i}`);

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confessionId: id, imageUrls, caption }),
    });

    await prisma.confession.update({
      where: { id },
      data: { status: 'posted' },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Webhook error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
