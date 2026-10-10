const { PrismaClient } = require('@prisma/client');
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
      permissions: JSON.stringify(['ALL']),
    },
  });

  const salesRole = await prisma.role.upsert({
    where: { name: 'مبيعات' },
    update: {},
    create: {
      name: 'مبيعات',
      permissions: JSON.stringify(['CREATE_INVOICE', 'VIEW_PRODUCTS', 'VIEW_PATIENTS', 'CREATE_DEPOSIT', 'VIEW_TREASURY', 'VIEW_REPORTS', 'MANAGE_PURCHASES', 'CREATE_EXPENSE']),
    },
  });

  const bcrypt = require('bcrypt');
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
      fullName: 'مدير النظام',
      roleId: adminRole.id,
      isActive: true,
    }
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
