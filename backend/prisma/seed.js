const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding fresh data...');

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
      permissions: JSON.stringify([
        'CREATE_INVOICE',
        'VIEW_PRODUCTS',
        'VIEW_PATIENTS',
        'CREATE_DEPOSIT',
        'VIEW_TREASURY',
        'VIEW_REPORTS',
        'MANAGE_PURCHASES',
        'CREATE_EXPENSE'
      ]),
    },
  });

  // 2. Users
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      fullName: 'مدير النظام',
      roleId: adminRole.id,
      isActive: true,
    }
  });

  const salesPasswordHash = await bcrypt.hash('sales123', 10);
  await prisma.user.upsert({
    where: { username: 'sales' },
    update: {},
    create: {
      username: 'sales',
      passwordHash: salesPasswordHash,
      fullName: 'موظف مبيعات الكانتين',
      roleId: salesRole.id,
      isActive: true,
    }
  });

  // 3. Default Payment Methods
  const methods = ['نقدي (الدرج)', 'فودافون كاش', 'الخزينة (الرئيسية)'];
  for (const method of methods) {
    await prisma.paymentMethod.upsert({
      where: { name: method },
      update: {},
      create: { name: method },
    });
  }

  // 4. Default Expense Categories
  const categories = ['مواد غذائية', 'نظافة', 'صيانة', 'نقل', 'سداد لمورد', 'متنوع', 'أخرى'];
  for (const cat of categories) {
    await prisma.expenseCategory.upsert({
      where: { name: cat },
      update: {},
      create: { name: cat, isDefault: true },
    });
  }

  // 5. Initial Sample Products
  const sampleProducts = [
    { name: 'شيبسي عائلي', internalCode: 'PROD-001', barcode: '123456789', sellingPrice: 10, purchasePrice: 8.5, unit: 'كيس', stock: 50 },
    { name: 'بيبسي 1 لتر', internalCode: 'PROD-002', barcode: '123456788', sellingPrice: 15, purchasePrice: 12, unit: 'زجاجة', stock: 35 },
    { name: 'بسكويت بوريو', internalCode: 'PROD-003', barcode: '123456787', sellingPrice: 5, purchasePrice: 4, unit: 'قطعة', stock: 60 },
    { name: 'مياه معدنية صافي كبير', internalCode: 'PROD-004', barcode: '123456786', sellingPrice: 5, purchasePrice: 3.5, unit: 'زجاجة', stock: 80 },
    { name: 'عصير جهينة مانجو', internalCode: 'PROD-005', barcode: '123456785', sellingPrice: 8, purchasePrice: 6.5, unit: 'علبة', stock: 40 },
    { name: 'شيكولاتة جالاكسي', internalCode: 'PROD-006', barcode: '123456784', sellingPrice: 25, purchasePrice: 20, unit: 'قطعة', stock: 30 },
    { name: 'كادبوري ديري ميلك', internalCode: 'PROD-007', barcode: '123456783', sellingPrice: 20, purchasePrice: 16, unit: 'قطعة', stock: 25 },
  ];

  for (const p of sampleProducts) {
    const createdProduct = await prisma.product.upsert({
      where: { internalCode: p.internalCode },
      update: {},
      create: {
        name: p.name,
        internalCode: p.internalCode,
        barcode: p.barcode,
        sellingPrice: p.sellingPrice,
        purchasePrice: p.purchasePrice,
        unit: p.unit,
        conversionFactor: 1,
        alertThreshold: 10,
        isActive: true,
      }
    });

    // Create initial batch for stock
    const existingBatch = await prisma.batch.findFirst({
      where: { productId: createdProduct.id }
    });

    if (!existingBatch) {
      await prisma.batch.create({
        data: {
          productId: createdProduct.id,
          quantityRemaining: p.stock,
          unitCost: p.purchasePrice,
        }
      });
    }
  }

  // 6. Default Supplier
  await prisma.supplier.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'شركة الأغذية والمشروبات للمستلزمات',
      address: 'القاهرة',
      notes: 'المورد الرئيسي للكانتين',
      isActive: true,
    }
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
