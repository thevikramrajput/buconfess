import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/auth';
import { generateConfessionImage, splitTextIntoParts } from '@/lib/imageGenerator';
import path from 'path';

export async function POST(req: NextRequest) {
  const isAdmin = await getAdminFromRequest();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  const confession = await prisma.confession.findUnique({ where: { id } });
  if (!confession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const counter = await prisma.counter.findFirst();
  const confessionNumber = (counter?.value || 0) + 1;
  await prisma.counter.updateMany({ data: { value: confessionNumber } });
  await prisma.confession.update({ where: { id }, data: { number: confessionNumber } });

  const parts = splitTextIntoParts(confession.text);
  const outputDir = path.join(process.cwd(), 'public', 'images', 'confessions', String(id));
  const imagePaths: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const filepath = await generateConfessionImage(parts[i], confessionNumber, i, parts.length, outputDir);
    imagePaths.push(filepath);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const imageUrls = imagePaths.map((_, i) =>
    appUrl + '/images/confessions/' + id + '/confession_' + confessionNumber + '_part' + (i + 1) + '.jpg'
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
