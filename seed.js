const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { execSync } = require('child_process');

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('Running prisma db push...');
    try {
      execSync('npx prisma db push --schema=/app/prisma/schema.prisma --accept-data-loss', { stdio: 'inherit' });
    } catch (e) {
      console.error('db push error', e.message);
    }
    console.log('Seeding admin...');
    const username = process.env.ADMIN_USERNAME || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'buconfess@admin2024';
    const existing = await prisma.admin.findUnique({ where: { username } });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await prisma.admin.create({ data: { username, password: hashedPassword } });
      console.log('Admin seeded successfully');
    } else {
      console.log('Admin already exists');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(0);
});
