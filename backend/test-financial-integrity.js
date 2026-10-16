const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const shiftsService = require('./src/features/shifts/shifts.service');
const salesService = require('./src/features/sales/sales.service');
const patientsService = require('./src/features/patients/patients.service');
const treasuryService = require('./src/features/treasury/treasury.service');

async function runFinancialAuditTest() {
  console.log('====================================================');
  console.log('🧪 بدء الاختبار الشامل للنزاهة المالية ونظام الورديات');
  console.log('====================================================');

  // 1. Get Admin / Cashier User
  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user found');
  console.log(`👤 تم اختيار المستخدم للاختبار: ${user.fullName} (ID: ${user.id})`);

  // 2. Close any lingering open shift first
  const activeExisting = await prisma.dailyShift.findFirst({ where: { status: 'OPEN' } });
  if (activeExisting) {
    console.log(`⚠️ توجد وردية مفتوحة سابقة #${activeExisting.shiftNumber}، جاري تقفيلها للبدء من بيئة نظيفة...`);
    const drawer = await prisma.paymentMethod.findFirst({ where: { name: { contains: 'درج' } } });
    const bal = drawer ? Number(drawer.currentBalance) : 0;
    await shiftsService.closeShift({ countedAmount: bal, transferAmount: 0, notes: 'تقفيل تمهيدي للاختبار' }, user.id);
  }

  // 3. Test POS Lockdown when shift is CLOSED
  console.log('\n🔒 [اختبار 1] محاولة البيع واليومية مغلقة...');
  const testProduct = await prisma.product.findFirst({ where: { isActive: true } });
  if (!testProduct) throw new Error('No product found');

  let saleBlockedSuccessfully = false;
  try {
    await salesService.createSale({
      items: [{ productId: testProduct.id, quantity: 1 }],
      type: 'CASH',
      paymentMethodId: 1
    }, user.id);
  } catch (err) {
    if (err.message.includes('اليومية مغلقة حالياً')) {
      saleBlockedSuccessfully = true;
      console.log(`✅ نجح الإغلاق المحكم: تم رفض البيع بالرسالة المعتمدة: "${err.message}"`);
    } else {
      console.error('❌ خطأ غير متوقع:', err.message);
    }
  }

  if (!saleBlockedSuccessfully) {
    throw new Error('❌ فشل الحماية! تم السماح بالبيع واليومية مغلقة!');
  }

  // 4. Test Opening Shift
  console.log('\n🔓 [اختبار 2] فتح يومية ووردية جديدة...');
  const drawerMethodBefore = await prisma.paymentMethod.findFirst({ where: { name: { contains: 'درج' } } });
  const startCash = Number(drawerMethodBefore.currentBalance);

  const openedShift = await shiftsService.openShift({
    startingCash: startCash,
    notes: 'افتتاح وردية اختبار النزاهة المالية'
  }, user.id);

  console.log(`✅ تم فتح الوردية بنجاح: رقم #${openedShift.shiftNumber} بعهدة ${openedShift.startingCash} ج.م`);

  // 5. Test Cash Sale
  console.log('\n💵 [اختبار 3] عملية بيع نقدي...');
  const drawerBeforeSale = await prisma.paymentMethod.findUnique({ where: { id: drawerMethodBefore.id } });
  const saleItemPrice = Number(testProduct.sellingPrice);

  const saleRes = await salesService.createSale({
    items: [{ productId: testProduct.id, quantity: 1 }],
    type: 'CASH',
    paymentMethodId: drawerMethodBefore.id
  }, user.id);

  const drawerAfterSale = await prisma.paymentMethod.findUnique({ where: { id: drawerMethodBefore.id } });
  const drawerDiff = Number(drawerAfterSale.currentBalance) - Number(drawerBeforeSale.currentBalance);
  console.log(`فاتورة بيع رقم: ${saleRes.invoiceNumber} بقيمة: ${saleItemPrice} ج.م`);
  console.log(`رصيد الدرج قبل: ${drawerBeforeSale.currentBalance} ج.م -> بعد: ${drawerAfterSale.currentBalance} ج.م (فارق: +${drawerDiff} ج.م)`);

  if (Math.abs(drawerDiff - saleItemPrice) > 0.001) {
    throw new Error(`❌ خطأ مالي: الفارق في الدرج (${drawerDiff}) لا يطابق قيمة البيع (${saleItemPrice})!`);
  }
  console.log('✅ عملية البيع النقدي سليمة 100%');

  // 6. Test Patient Account (Credit) Sale
  console.log('\n💳 [اختبار 4] عملية بيع على حساب مريض...');
  const patient = await prisma.patient.findFirst({ where: { isActive: true } });
  if (!patient) throw new Error('No patient found');

  const patientDebtBefore = Number(patient.currentDebt);
  const drawerBeforeCredit = await prisma.paymentMethod.findUnique({ where: { id: drawerMethodBefore.id } });

  await salesService.createSale({
    patientId: patient.id,
    items: [{ productId: testProduct.id, quantity: 1 }],
    type: 'CREDIT'
  }, user.id);

  const patientAfter = await prisma.patient.findUnique({ where: { id: patient.id } });
  const drawerAfterCredit = await prisma.paymentMethod.findUnique({ where: { id: drawerMethodBefore.id } });

  const patientDebtDiff = Number(patientAfter.currentDebt) - patientDebtBefore;
  const drawerCreditDiff = Number(drawerAfterCredit.currentBalance) - Number(drawerBeforeCredit.currentBalance);

  console.log(`حساب المريض قبل: ${patientDebtBefore} ج.م -> بعد: ${patientAfter.currentDebt} ج.م (فارق: ${patientDebtDiff} ج.م)`);
  console.log(`رصيد الدرج النقدي فارق: ${drawerCreditDiff} ج.م (يجب أن يكون 0)`);

  if (Math.abs(drawerCreditDiff) > 0.001) {
    throw new Error('❌ خطأ مالي: عملية البيع على الحساب أثرت على رصيد الدرج النقدي!');
  }
  console.log('✅ عملية البيع على حساب المريض سليمة 100%');

  // 7. Test Patient Deposit into Drawer
  console.log('\n📥 [اختبار 5] إيداع أمانات مريض في الدرج النقدي...');
  const depositAmount = 150;
  const drawerBeforeDeposit = await prisma.paymentMethod.findUnique({ where: { id: drawerMethodBefore.id } });

  await patientsService.addTransaction({
    patientId: patient.id,
    type: 'DEPOSIT',
    amount: depositAmount,
    source: 'نقدي (الدرج)',
    description: 'إيداع نقدي تجريبي'
  }, user.id);

  const drawerAfterDeposit = await prisma.paymentMethod.findUnique({ where: { id: drawerMethodBefore.id } });
  const depositDiff = Number(drawerAfterDeposit.currentBalance) - Number(drawerBeforeDeposit.currentBalance);
  console.log(`إيداع ${depositAmount} ج.م: رصيد الدرج قبل ${drawerBeforeDeposit.currentBalance} -> بعد ${drawerAfterDeposit.currentBalance} (فارق: +${depositDiff} ج.م)`);

  if (Math.abs(depositDiff - depositAmount) > 0.001) {
    throw new Error(`❌ خطأ مالي: إيداع المريض لم ينعكس بدقة في الدرج!`);
  }
  console.log('✅ إيداع المريض سليم 100%');

  // 8. Test Live Shift Stats & Mathematical Integrity
  console.log('\n⚖️ [اختبار 6] التحقق من معادلة النقدية بالدرج والوردية...');
  const shiftStatus = await shiftsService.getCurrentShift();
  console.log('تقرير الوردية المباشر:', {
    رقم_الوردية: shiftStatus.currentShift.shiftNumber,
    عهدة_البداية: shiftStatus.currentShift.startingCash,
    المبيعات_النقدية: shiftStatus.currentShift.cashSales,
    إيداعات_المرضى: shiftStatus.currentShift.deposits,
    المصروفات_والسحوبات: shiftStatus.currentShift.expenses,
    التوريدات_السابقة: shiftStatus.currentShift.transfers,
    النقدية_المتوقعة: shiftStatus.currentShift.expectedCash,
    رصيد_الدرج_الفعلي: shiftStatus.currentShift.currentDrawerBalance
  });

  if (Math.abs(shiftStatus.currentShift.expectedCash - shiftStatus.currentShift.currentDrawerBalance) > 0.001) {
    throw new Error('❌ خطأ في المطابقة: النقدية المتوقعة بالوردية لا تطابق رصيد الدرج!');
  }
  console.log('✅ معادلة الوردية مطابقة لرصيد الدرج بالقرش (Discrepancy = 0)');

  // 9. Test Shift Closing & Safe Transfer
  console.log('\n🔒 [اختبار 7] تقفيل الوردية وتوريد نقدية إلى الخزينة الرئيسية...');
  const mainTreasuryBefore = await prisma.paymentMethod.findFirst({ where: { name: { contains: 'الخزينة' } } });
  const drawerBeforeClose = await prisma.paymentMethod.findUnique({ where: { id: drawerMethodBefore.id } });

  const counted = Number(drawerBeforeClose.currentBalance);
  const transferToSafe = Math.min(counted, 100);

  const closeResult = await shiftsService.closeShift({
    countedAmount: counted,
    transferAmount: transferToSafe,
    notes: 'تقفيل تجربة النزاهة المالية بنجاح'
  }, user.id);

  const mainTreasuryAfter = await prisma.paymentMethod.findUnique({ where: { id: mainTreasuryBefore.id } });
  const drawerAfterClose = await prisma.paymentMethod.findUnique({ where: { id: drawerMethodBefore.id } });

  const safeDiff = Number(mainTreasuryAfter.currentBalance) - Number(mainTreasuryBefore.currentBalance);
  const drawerCloseDiff = Number(drawerBeforeClose.currentBalance) - Number(drawerAfterClose.currentBalance);

  console.log(`توريد للخزينة الرئيسية: ${transferToSafe} ج.م`);
  console.log(`الخزينة الرئيسية: زادت بمقدار +${safeDiff} ج.م`);
  console.log(`الدرج النقدي: نقص بمقدار -${drawerCloseDiff} ج.م`);
  console.log(`المتبقي بالدرج للغد: ${drawerAfterClose.currentBalance} ج.م`);
  console.log(`حالة مطابقة التقفيل: ${closeResult.receipt.discrepancyText}`);

  if (Math.abs(safeDiff - transferToSafe) > 0.001 || Math.abs(drawerCloseDiff - transferToSafe) > 0.001) {
    throw new Error('❌ خطأ مالي في توريد التقفيل بين الدرج والخزينة الرئيسية!');
  }
  console.log('✅ تقفيل الوردية والتوريد للخزينة الرئيسية سليم 100%');

  // 10. Re-verify POS Lockdown
  const closedCheck = await shiftsService.getCurrentShift();
  if (closedCheck.isOpen) throw new Error('❌ الوردية لم تغلق بالشكل الصحيح!');
  console.log('\n🔒 [اختبار 8] إعادة التأكد من قفل البيع بعد التقفيل...');
  let secondBlockSuccess = false;
  try {
    await salesService.createSale({
      items: [{ productId: testProduct.id, quantity: 1 }],
      type: 'CASH',
      paymentMethodId: drawerMethodBefore.id
    }, user.id);
  } catch (err) {
    if (err.message.includes('اليومية مغلقة حالياً')) {
      secondBlockSuccess = true;
      console.log(`✅ تم حظر البيع بنجاح: "${err.message}"`);
    }
  }

  if (!secondBlockSuccess) throw new Error('❌ فشل حظر البيع بعد التقفيل!');

  // 11. Re-open shift with remaining cash to leave system in clean open state
  console.log('\n🔓 [إعادة تشغيل] فتح وردية جديدة بالرصيد المتبقي لترك السيستم جاهزاً للاستخدام...');
  const newShift = await shiftsService.openShift({
    startingCash: Number(drawerAfterClose.currentBalance),
    notes: 'وردية جديدة جاهزة للتشغيل اليومي'
  }, user.id);
  console.log(`✅ تم فتح وردية جديدة #${newShift.shiftNumber} بعهدة ${newShift.startingCash} ج.م`);

  console.log('\n====================================================');
  console.log('🎉 نجح الاختبار المالي بالكامل! جميع المعاملات دقيقة 100%');
  console.log('====================================================');
}

runFinancialAuditTest()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('\n❌ فشل الاختبار المالي:', err);
    prisma.$disconnect();
    process.exit(1);
  });
