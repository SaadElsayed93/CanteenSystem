/**
 * المستشفى العسكري ق.م بالإسماعيلية - إدارة الكانتين والمطبخ
 * سكريبت التصفير الآمن للبيانات التجريبية قبل التسليم الفعلي الميداني
 * 
 * يحتفظ بالبيانات الأساسية:
 * 1. المستخدمين والأدوار والصلاحيات (Users & Roles)
 * 2. الأصناف والمشروبات وشجرة المكونات والوصفات (Products & ProductIngredients BOM)
 * 3. الموردين وقنوات الدفع والخزائن وإعدادات النظام (Suppliers, PaymentMethods, Settings)
 * 
 * ويقوم بتصفير:
 * - الفواتير التجريبية وبنودها
 * - المرتجعات التجريبية
 * - حركات المرضى وديونهم
 * - الورديات اليومية
 * - حركات الخزينة والمصروفات التجريبية
 * - الحركات المخزنية التجريبية والدفعات التجريبية
 * - سجل الرقابة والتدقيق التجريبي (AuditLogs)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetCleanData() {
  console.log('================================================================');
  console.log(' 🏥 منظومة كانتين المستشفى العسكري ق.م بالإسماعيلية');
  console.log(' 🧹 بدء عملية التصفير الآمن للبيانات التجريبية...');
  console.log('================================================================\n');

  try {
    // 1. تصفير المبيعات والفواتير والمرتجعات
    console.log('⏳ [1/7] تصفير المرتجعات وفواتير المبيعات...');
    await prisma.returnItem.deleteMany({});
    await prisma.return.deleteMany({});
    await prisma.invoiceItem.deleteMany({});
    await prisma.invoice.deleteMany({});

    // 2. تصفير الورديات المقفلة والمفتوحة
    console.log('⏳ [2/7] تصفير الورديات السابقة...');
    await prisma.dailyShift.deleteMany({});

    // 3. تصفير حركات المرضى وتصفير مديونياتهم
    console.log('⏳ [3/7] تصفير سجل معاملات المرضى وتصفير الأرصدة...');
    await prisma.patientTransaction.deleteMany({});
    await prisma.patient.updateMany({
      data: { currentDebt: 0 }
    });

    // 4. تصفير المشتريات ودفعات الموردين التجريبية وتصفير أرصدة الموردين
    console.log('⏳ [4/7] تصفير حركات المشتريات والدفعات التجريبية للموردين...');
    await prisma.supplierPayment.deleteMany({});
    await prisma.inventoryMovement.deleteMany({});
    await prisma.batch.deleteMany({});
    await prisma.purchaseItem.deleteMany({});
    await prisma.supplierPurchase.deleteMany({});

    // 5. تصفير المصروفات وحركات الخزينة وتصفير أرصدة الخزائن
    console.log('⏳ [5/7] تصفير المصروفات وحركات الخزينة وتصفير الأرصدة...');
    await prisma.expense.deleteMany({});
    await prisma.treasuryTransaction.deleteMany({});
    await prisma.paymentMethod.updateMany({
      data: { currentBalance: 0 }
    });

    // 6. تصفير الجرد وسجلات الرقابة التجريبية
    console.log('⏳ [6/7] تصفير محاضر الجرد وسجلات الرقابة...');
    await prisma.inventoryCount.deleteMany({});
    await prisma.auditLog.deleteMany({});

    // 7. التأكد من سلامة الأصناف والمكونات والوصفات
    const productsCount = await prisma.product.count();
    const recipesCount = await prisma.productIngredient.count();
    const usersCount = await prisma.user.count();
    const paymentMethodsCount = await prisma.paymentMethod.count();

    console.log('\n================================================================');
    console.log(' ✅ تم التصفير الآمن بنجاح تام! النظام الآن جاهز للعمل الفعلي:');
    console.log(`   - عدد المستخدمين النشطين: ${usersCount}`);
    console.log(`   - عدد الأصناف المسجلة: ${productsCount}`);
    console.log(`   - عدد شجرات المكونات والوصفات المحفوظة: ${recipesCount}`);
    console.log(`   - عدد الخزائن والقنوات المهيأة: ${paymentMethodsCount}`);
    console.log('   - أرصدة الخزائن: 0.00 ج.م');
    console.log('   - أرصدة المرضى والديون: 0.00 ج.م');
    console.log('   - الفواتير والمرتجعات: 0 (مصفرة تماماً)');
    console.log('================================================================\n');

  } catch (error) {
    console.error('❌ حدث خطأ أثناء التصفير:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  resetCleanData();
}

module.exports = { resetCleanData };
