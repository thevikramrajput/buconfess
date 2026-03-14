import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const existing = await prisma.admin.count();
    if (existing > 0) return NextResponse.json({ message: 'Already setup' });
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    const hashed = await bcrypt.hash(password, 10);
    await prisma.admin.create({ data: { username, password: hashed } });
    await prisma.counter.create({ data: { value: 0 } });
    return NextResponse.json({ success: true, message: 'Admin created. Please change your password!' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
