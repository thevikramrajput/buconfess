import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const existing = await prisma.admin.count();
  if (existing === 0) {
    await prisma.admin.create({
      data: {
        username: process.env.ADMIN_USERNAME || 'admin',
        password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10),
      },
    });
    await prisma.counter.create({ data: { value: 0 } });
    console.log('Admin created');
  } else { console.log('Admin already exists'); }
}
main().finally(() => prisma.$disconnect());
