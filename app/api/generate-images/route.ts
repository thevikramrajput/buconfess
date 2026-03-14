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

  // Assign confession number from counter
  const counter = await prisma.counter.findFirst();
  const confessionNumber = (counter?.value || 0) + 1;
  await prisma.counter.updateMany({ data: { value: confessionNumber } });
  await prisma.confession.update({ where: { id }, data: { number: confessionNumber } });

  // Split text into parts — store only text, images generated on-demand
  const parts = splitTextIntoParts(confession.text);

  // imageUrls stores part indices as JSON - actual images generated on-demand via /api/image/[id]/[part]
  const imageUrls = parts.map((_, i) =>
    `/api/image/${id}/${i}`
  );

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