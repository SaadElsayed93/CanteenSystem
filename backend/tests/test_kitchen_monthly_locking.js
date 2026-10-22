const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const reportsService = require('../src/features/reports/reports.service');

async function runTests() {
  console.log('🧪 Starting Kitchen Monthly Locking & Preservation Automated Tests...\n');

  try {
    const admin = await prisma.user.findFirst({ where: { username: 'admin' } }) || await prisma.user.findFirst();
    if (!admin) throw new Error('No user found');

    const startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const monthKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const settingKey = `KITCHEN_CLOSING_${monthKey}`;

    // Clean any prior closing for clean test execution
    await prisma.setting.deleteMany({ where: { key: settingKey } });

    console.log(`--- Test 1: Status before closing for month ${monthKey} ---`);
    const statusBefore = await reportsService.getKitchenClosingStatus(startDate, endDate);
    if (statusBefore.isClosed !== false) {
      throw new Error(`Expected isClosed: false before closing, got ${statusBefore.isClosed}`);
    }
    console.log(`✅ Status is correctly NOT closed (isClosed: false)`);
    console.log(`   - Materials count: ${statusBefore.materials.length}`);
    console.log(`   - Auxiliary count: ${statusBefore.auxiliaryMaterials.length}`);

    const bun = statusBefore.auxiliaryMaterials.find(m => m.name.includes('خبز') || m.name.includes('كايزر') || m.name.includes('فينو')) 
      || statusBefore.auxiliaryMaterials[0];
    if (!bun) throw new Error('No auxiliary material found to test');

    console.log(`\n--- Test 2: Commit Kitchen Closing & Freeze Month ---`);
    const targetRemaining = Math.max(0, bun.currentStock - 2);
    const commitResult = await reportsService.settleKitchenMonth({
      startDate,
      endDate,
      notes: 'تقفيل واعتماد شهر تجريبي لاختبار التجميد والحفظ',
      items: [
        {
          productId: bun.id,
          actualRemaining: targetRemaining,
          reason: 'جرد فعلي معتمد'
        }
      ]
    }, admin.id);

    if (commitResult.status !== 'CLOSED' || !commitResult.isClosed) {
      throw new Error(`Expected status: 'CLOSED' and isClosed: true in commit result`);
    }
    console.log(`✅ Month closing snapshot generated:`);
    console.log(`   - Month Key: ${commitResult.monthKey}`);
    console.log(`   - Status: ${commitResult.status}`);
    console.log(`   - Closed By: ${commitResult.closedBy?.fullName}`);
    console.log(`   - Net Kitchen Profit: ${commitResult.summary.netKitchenProfit} EGP`);
    console.log(`   - Auxiliary Cost: ${commitResult.summary.totalAuxConsumedCost} EGP`);

    console.log(`\n--- Test 3: Verify Persistence in Setting Database ---`);
    const savedSetting = await prisma.setting.findUnique({ where: { key: settingKey } });
    if (!savedSetting) throw new Error(`Setting record ${settingKey} was not created in db`);
    const parsedData = JSON.parse(savedSetting.value);
    if (parsedData.status !== 'CLOSED' || parsedData.isClosed !== true) {
      throw new Error(`Invalid data stored in Setting: ${savedSetting.value}`);
    }
    console.log(`✅ Snapshot successfully persisted in Setting table with key: ${settingKey}`);

    console.log(`\n--- Test 4: Re-fetching Kitchen Closing Status (Must Return Frozen Snapshot) ---`);
    const statusAfter = await reportsService.getKitchenClosingStatus(startDate, endDate);
    if (statusAfter.isClosed !== true) {
      throw new Error(`Expected isClosed: true after closing, got: ${statusAfter.isClosed}`);
    }
    if (statusAfter.isEditMode !== false) {
      throw new Error(`Expected isEditMode: false (read-only) by default for closed month`);
    }
    console.log(`✅ Month returned as CLOSED & LOCKED (isClosed: true, isEditMode: false)`);
    console.log(`   - Closed At: ${statusAfter.closedAt}`);
    console.log(`   - Net Profit (Frozen): ${statusAfter.summary.netKitchenProfit} EGP`);

    // Verify material in the returned snapshot contains the approved actualRemaining
    const bunInSnapshot = statusAfter.materials.find(m => m.id === bun.id);
    if (bunInSnapshot.actualRemaining !== targetRemaining) {
      throw new Error(`Expected actualRemaining ${targetRemaining}, got ${bunInSnapshot.actualRemaining}`);
    }
    console.log(`✅ Material count is preserved exactly as approved: ${bunInSnapshot.actualRemaining} (not wiped or reset!)`);

    console.log(`\n--- Test 5: Verify Monthly Financial Report Integration ---`);
    const monthlyReport = await reportsService.getDetailedReport('MONTHLY_FINANCIAL', startDate, endDate, {});
    if (monthlyReport.isKitchenClosed !== true) {
      throw new Error(`Expected monthlyReport.isKitchenClosed to be true`);
    }
    if (!monthlyReport.kitchenClosing) {
      throw new Error(`Expected monthlyReport.kitchenClosing to contain snapshot`);
    }
    if (monthlyReport.summary.kitchenSettlementCost !== commitResult.summary.totalAuxConsumedCost) {
      throw new Error(`Expected kitchenSettlementCost ${commitResult.summary.totalAuxConsumedCost}, got ${monthlyReport.summary.kitchenSettlementCost}`);
    }
    console.log(`✅ Monthly Financial Report correctly incorporated the approved kitchen closing:`);
    console.log(`   - isKitchenClosed: ${monthlyReport.isKitchenClosed}`);
    console.log(`   - Kitchen Settled Cost: ${monthlyReport.summary.kitchenSettlementCost} EGP`);
    console.log(`   - Sandwich Division Auxiliary Cost: ${monthlyReport.summary.divisions.SANDWICH.auxiliaryCost} EGP`);
    console.log(`   - Sandwich Division Profit: ${monthlyReport.summary.divisions.SANDWICH.profit} EGP`);

    console.log(`\n--- Test 6: Test Admin Edit / Update Mode ---`);
    const updatedTargetRemaining = Math.max(0, bun.currentStock - 1);
    const updateResult = await reportsService.settleKitchenMonth({
      startDate,
      endDate,
      notes: 'تعديل التقفيلة المعتمدة لاختبار زر التعديل',
      items: [
        {
          productId: bun.id,
          actualRemaining: updatedTargetRemaining,
          reason: 'تعديل رقم الجرد الفعلي'
        }
      ],
      isUpdate: true
    }, admin.id);

    if (!updateResult.updatedAt || !updateResult.updatedBy) {
      throw new Error(`Expected updatedAt and updatedBy on updateResult`);
    }
    console.log(`✅ Re-approval with isUpdate: true succeeded:`);
    console.log(`   - Updated At: ${updateResult.updatedAt}`);
    console.log(`   - Updated By: ${updateResult.updatedBy.fullName}`);

    const statusAfterUpdate = await reportsService.getKitchenClosingStatus(startDate, endDate);
    const bunAfterUpdate = statusAfterUpdate.materials.find(m => m.id === bun.id);
    if (bunAfterUpdate.actualRemaining !== updatedTargetRemaining) {
      throw new Error(`Expected updated remaining ${updatedTargetRemaining}, got ${bunAfterUpdate.actualRemaining}`);
    }
    console.log(`✅ Re-fetched status reflects the adjusted count: ${bunAfterUpdate.actualRemaining}`);

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED! 🎉');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
