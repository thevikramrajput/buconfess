import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/auth';
import { splitTextIntoParts } from '@/lib/imageGenerator';

export async function POST(req: NextRequest) {
  const isAdmin = await getAdminFromRequest();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await req.json();
  const confession = await prisma.confession.findUnique({ where: { id } });
  if (!confession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let confessionNumber = confession.number;
  if (!confessionNumber) {
    const counter = await prisma.counter.findFirst();
    confessionNumber = (counter?.value || 0) + 1;
    await prisma.counter.updateMany({ data: { value: confessionNumber } });
    await prisma.confession.update({ where: { id }, data: { number: confessionNumber } });
  }

  const parts = splitTextIntoParts(confession.text);
  const imageUrls = parts.map((_, index) => `/api/image/${id}/${index}`);

  await prisma.confession.update({
    where: { id },
    data: {
      parts: JSON.stringify(parts),
      imageUrls: JSON.stringify(imageUrls),
      status: 'approved',
    },
  });

  return NextResponse.json({ success: true, parts, imageUrls, confessionNumber });
}
