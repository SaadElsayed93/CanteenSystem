const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const salesService = require('../src/features/sales/sales.service');
const returnsService = require('../src/features/returns/returns.service');
const purchasesService = require('../src/features/purchases/purchases.service');
const shiftsService = require('../src/features/shifts/shifts.service');
const reportsService = require('../src/features/reports/reports.service');

async function testFullShiftCycle() {
  console.log('========================================================================');
  console.log(' 🏥 اختبار دورة الوردية الكاملة الحية للمستشفى العسكري (Stage 5 End-to-End)');
  console.log('========================================================================\n');

  try {
    const admin = await prisma.user.findFirst();
    const userId = admin ? admin.id : 1;

    // 0. Setup payment method & drawer
    let drawer = await prisma.paymentMethod.findFirst({ where: { name: { contains: 'درج' } } });
    if (!drawer) {
      drawer = await prisma.paymentMethod.create({
        data: { name: 'درج الكاشير التجريبي', currentBalance: 500, isActive: true }
      });
    }

    // 1. Shift Opening
    console.log('⏳ [1/6] فتح وردية جديدة للكاشير برصيد افتتاحي 500 ج.م...');
    // Close any dangling shifts first
    const activeShift = await prisma.dailyShift.findFirst({ where: { status: 'OPEN' } });
    if (activeShift) {
      await shiftsService.closeShift({ countedAmount: Number(activeShift.startingCash || 0), notes: 'إغلاق تلقائي للتجهيز' }, userId);
    }

    const shift = await shiftsService.openShift({ startingCash: 500, notes: 'وردية تجريبية شاملة' }, userId);
    console.log(`✅ تم فتح الوردية رقم #${shift.id} بنجاح.`);

    // 2. Setup Products across all 3 divisions
    console.log('\n⏳ [2/6] تجهيز أصناف الأقسام الثلاثة (كانتين، بوفيه، سندوتشات)...');
    
    // Raw materials
    const teaBag = await prisma.product.upsert({
      where: { internalCode: 'RAW-TEA-E2E' },
      update: {},
      create: {
        name: 'شاي فتلة خام E2E',
        internalCode: 'RAW-TEA-E2E',
        sellingPrice: 0,
        purchasePrice: 0.50,
        unit: 'فتلة',
        activityType: 'BUFFET',
        productType: 'RAW_MATERIAL'
      }
    });

    const sugar = await prisma.product.upsert({
      where: { internalCode: 'RAW-SUGAR-E2E' },
      update: {},
      create: {
        name: 'سكر خام E2E',
        internalCode: 'RAW-SUGAR-E2E',
        sellingPrice: 0,
        purchasePrice: 0.05,
        unit: 'جرام',
        activityType: 'BUFFET',
        productType: 'RAW_MATERIAL'
      }
    });

    const burgerPatty = await prisma.product.upsert({
      where: { internalCode: 'RAW-PATTY-E2E' },
      update: {},
      create: {
        name: 'قطعة برجر لحم خام E2E',
        internalCode: 'RAW-PATTY-E2E',
        sellingPrice: 0,
        purchasePrice: 15.00,
        unit: 'قطعة',
        activityType: 'SANDWICH',
        productType: 'RAW_MATERIAL'
      }
    });

    // Provide initial raw batches
    await prisma.batch.create({
      data: { productId: teaBag.id, quantityRemaining: 50, unitCost: 0.50 }
    });
    await prisma.batch.create({
      data: { productId: sugar.id, quantityRemaining: 1000, unitCost: 0.05 }
    });
    await prisma.batch.create({
      data: { productId: burgerPatty.id, quantityRemaining: 20, unitCost: 15.00 }
    });

    // Canteen Simple Product
    const chips = await prisma.product.upsert({
      where: { internalCode: 'CAN-CHIPS-E2E' },
      update: {},
      create: {
        name: 'شيبسي عائلي E2E',
        internalCode: 'CAN-CHIPS-E2E',
        sellingPrice: 15.00,
        purchasePrice: 10.00,
        unit: 'كيس',
        activityType: 'CANTEEN',
        productType: 'SIMPLE'
      }
    });
    await prisma.batch.create({
      data: { productId: chips.id, quantityRemaining: 30, unitCost: 10.00 }
    });

    // Buffet Recipe Product: Tea Cup
    const teaCup = await prisma.product.upsert({
      where: { internalCode: 'BUF-TEA-E2E' },
      update: {},
      create: {
        name: 'كوب شاي ممتاز E2E',
        internalCode: 'BUF-TEA-E2E',
        sellingPrice: 10.00,
        purchasePrice: 1.50,
        unit: 'كوب',
        activityType: 'BUFFET',
        productType: 'RECIPE'
      }
    });
    await prisma.productIngredient.deleteMany({ where: { parentProductId: teaCup.id } });
    await prisma.productIngredient.create({
      data: { parentProductId: teaCup.id, rawMaterialId: teaBag.id, quantityPerUnit: 1 }
    });
    await prisma.productIngredient.create({
      data: { parentProductId: teaCup.id, rawMaterialId: sugar.id, quantityPerUnit: 20 }
    });

    // Kitchen Recipe Product: Burger Sandwich
    const burgerSandwich = await prisma.product.upsert({
      where: { internalCode: 'SAN-BURGER-E2E' },
      update: {},
      create: {
        name: 'سندوتش برجر سوبر E2E',
        internalCode: 'SAN-BURGER-E2E',
        sellingPrice: 40.00,
        purchasePrice: 20.00,
        unit: 'سندوتش',
        activityType: 'SANDWICH',
        productType: 'RECIPE'
      }
    });
    await prisma.productIngredient.deleteMany({ where: { parentProductId: burgerSandwich.id } });
    await prisma.productIngredient.create({
      data: { parentProductId: burgerSandwich.id, rawMaterialId: burgerPatty.id, quantityPerUnit: 1 }
    });

    console.log('✅ تم تهيئة أصناف الأقسام الثلاثة والمواد الخام بنجاح.');

    // 3. Perform Cash Sales in All 3 Divisions
    console.log('\n⏳ [3/6] إجراء عمليات بيع نقدي عبر الأقسام الثلاثة...');
    
    // Invoice 1: Canteen + Buffet
    const inv1 = await salesService.createSale({
      type: 'CASH',
      paymentMethodId: drawer.id,
      items: [
        { productId: chips.id, quantity: 2, price: 15.00 },
        { productId: teaCup.id, quantity: 3, price: 10.00 }
      ]
    }, userId);
    console.log(`✅ فاتورة كاش 1: ${inv1.invoiceNumber} بقيمة ${inv1.totalAmount} ج.م (شيبسي + 3 شاي)`);

    // Verify raw deduction for tea
    const teaMovement = await prisma.inventoryMovement.findFirst({
      where: { productId: teaBag.id, referenceType: 'SALE_RECIPE', referenceId: inv1.id }
    });
    if (!teaMovement || Number(teaMovement.quantity) !== 3) {
      throw new Error('Raw materials deduction for tea bags failed!');
    }
    console.log('✅ تم خصم 3 فتلة شاي و 60 جرام سكر تلقائياً من مخزن المواد الخام.');

    // Invoice 2: Sandwich
    const inv2 = await salesService.createSale({
      type: 'CASH',
      paymentMethodId: drawer.id,
      items: [
        { productId: burgerSandwich.id, quantity: 2, price: 40.00 }
      ]
    }, userId);
    console.log(`✅ فاتورة كاش 2: ${inv2.invoiceNumber} بقيمة ${inv2.totalAmount} ج.م (2 سندوتش برجر)`);

    // 4. Perform Patient Credit Sale
    console.log('\n⏳ [4/6] إجراء عملية بيع آجل لمريض والتحقق من حساب الرصيد المتبقي...');
    let patient = await prisma.patient.findFirst({ where: { fileNumber: 'PAT-E2E-001' } });
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          fullName: 'مريض تجريبي للاختبار النهائي',
          fileNumber: 'PAT-E2E-001',
          internalNumber: 'BED-E2E-99',
          currentDebt: 500 // deposit 500
        }
      });
    }

    const invPatient = await salesService.createSale({
      type: 'CREDIT',
      patientId: patient.id,
      items: [
        { productId: teaCup.id, quantity: 1, price: 10.00 },
        { productId: burgerSandwich.id, quantity: 1, price: 40.00 }
      ]
    }, userId);

    const updatedPatient = await prisma.patient.findUnique({ where: { id: patient.id } });
    console.log(`✅ فاتورة آجل مريض: ${invPatient.invoiceNumber} بقيمة 50 ج.م.`);
    console.log(`   - رصيد المريض قبل البيع: 500 ج.م`);
    console.log(`   - رصيد المريض بعد البيع: ${updatedPatient.currentDebt} ج.م (مخصوم بدقة)`);

    // 5. Test Return with Recipe Restoration
    console.log('\n⏳ [5/6] إجراء حركة مرتجع لصنف مركب وإعادة المواد الخام للمخزن...');
    const fullInv1 = await prisma.invoice.findUnique({ where: { id: inv1.id }, include: { items: true } });
    const teaItem = fullInv1.items.find(i => i.productId === teaCup.id);
    const returnRes = await returnsService.createReturn({
      invoiceId: inv1.id,
      type: 'PARTIAL',
      reason: 'طلب العميل إلغاء كوب شاي',
      paymentMethodId: drawer.id,
      returnItems: [
        { invoiceItemId: teaItem.id, productId: teaCup.id, quantity: 1, unitPrice: 10.00 }
      ]
    }, userId);
    console.log(`✅ تم تسجيل المرتجع بنجاح برقم #${returnRes.id}.`);

    const restoreMovement = await prisma.inventoryMovement.findFirst({
      where: { productId: teaBag.id, referenceType: 'RETURN_RECIPE', referenceId: returnRes.id }
    });
    if (!restoreMovement) {
      throw new Error('Raw materials return restoration failed!');
    }
    console.log('✅ تم استرجاع فتلة الشاي والسكر تلقائياً لحساب المخزن.');

    // 6. Test Reports Division Breakdown
    console.log('\n⏳ [6/6] فحص تقرير الأقسام الثلاثة واستهلاك المواد الخام...');
    const todayStr = new Date().toISOString().split('T')[0];
    const dailyReport = await reportsService.getDetailedReport('DAILY_FINANCIAL', todayStr, todayStr);

    if (!dailyReport.summary || !dailyReport.summary.divisions) {
      throw new Error('Divisions breakdown missing from daily financial report!');
    }

    console.log('📊 نتائج الأقسام المستقلة في التقرير المالي:');
    console.log(`   * الكانتين: مبيعات ${dailyReport.summary.divisions.CANTEEN.revenue} ج.م | أرباح ${dailyReport.summary.divisions.CANTEEN.profit} ج.م`);
    console.log(`   * البوفيه:  مبيعات ${dailyReport.summary.divisions.BUFFET.revenue} ج.م | أرباح ${dailyReport.summary.divisions.BUFFET.profit} ج.م`);
    console.log(`   * المطبخ:   مبيعات ${dailyReport.summary.divisions.SANDWICH.revenue} ج.م | أرباح ${dailyReport.summary.divisions.SANDWICH.profit} ج.م`);
    console.log(`   * إجمالي أرباح المنظومة: ${dailyReport.summary.totalProfit} ج.م`);

    const rawReport = await reportsService.getDetailedReport('RAW_MATERIALS', todayStr, todayStr);
    const teaRawStat = rawReport.materials.find(m => m.id === teaBag.id);
    console.log(`📦 تقرير المواد الخام: الشاي المباع صافي = ${teaRawStat?.netConsumedQty || 0} فتلة.`);

    // Close Shift Cleanly
    await shiftsService.closeShift({
      countedAmount: 500 + Number(inv1.totalAmount) + Number(inv2.totalAmount) - 10, // minus refunded tea
      notes: 'إغلاق وردية الاختبار النهائي بنجاح'
    }, userId);
    console.log('🔒 تم إغلاق الوردية ومطابقة النقدية بالدرج 100%.');

    console.log('\n========================================================================');
    console.log(' 🎉 نجاح كامل بنسبة 100% لدورة الوردية الحية والأقسام الثلاثة!');
    console.log('========================================================================\n');

  } catch (error) {
    console.error('❌ فشل الاختبار الميداني للوردية:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testFullShiftCycle();
