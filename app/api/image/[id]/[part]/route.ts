import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateConfessionImage, splitTextIntoParts } from '@/lib/imageGenerator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; part: string }> }
) {
  const { id: idStr, part: partStr } = await params;
  const id = parseInt(idStr);
  const partIndex = parseInt(partStr);

  const confession = await prisma.confession.findUnique({ where: { id } });
  if (!confession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parts = confession.parts ? JSON.parse(confession.parts) : splitTextIntoParts(confession.text);
  if (partIndex < 0 || partIndex >= parts.length) {
    return NextResponse.json({ error: 'Part not found' }, { status: 404 });
  }

  const buffer = await generateConfessionImage(
    parts[partIndex],
    confession.number || id,
    partIndex,
    parts.length
  );

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}