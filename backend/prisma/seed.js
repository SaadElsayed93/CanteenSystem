const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt'); // We'll install bcrypt later, or skip hashing for seed just to mock it now. Wait, I'll just use a raw hash for now or add bcrypt later.
// Let's just create roles and categories for now.

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding data...');

  // 1. Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'أدمن' },
    update: {},
    create: {
      name: 'أدمن',
      permissions: ['ALL'],
    },
  });

  const salesRole = await prisma.role.upsert({
    where: { name: 'مبيعات' },
    update: {},
    create: {
      name: 'مبيعات',
      permissions: ['CREATE_INVOICE', 'VIEW_PRODUCTS', 'VIEW_PATIENTS', 'CREATE_DEPOSIT'],
    },
  });

  // 2. Default Payment Methods
  const methods = ['نقدية', 'فودافون كاش', 'تحويل'];
  for (const method of methods) {
    await prisma.paymentMethod.upsert({
      where: { name: method },
      update: {},
      create: { name: method },
    });
  }

  // 3. Default Expense Categories
  const categories = ['مواد غذائية', 'نظافة', 'صيانة', 'نقل', 'متنوع', 'أخرى'];
  for (const cat of categories) {
    await prisma.expenseCategory.upsert({
      where: { name: cat },
      update: {},
      create: { name: cat, isDefault: true },
    });
  }

  console.log('✅ Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
