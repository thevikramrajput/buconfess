import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const isAdmin = await getAdminFromRequest();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = parseInt(params.id);
  const body = await req.json();
  const confession = await prisma.confession.update({ where: { id }, data: body });
  return NextResponse.json(confession);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const isAdmin = await getAdminFromRequest();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = parseInt(params.id);
  await prisma.confession.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
