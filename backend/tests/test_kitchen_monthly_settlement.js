const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const reportsService = require('../src/features/reports/reports.service');
const salesService = require('../src/features/sales/sales.service');

async function runTests() {
  console.log('🧪 Starting Kitchen Month-End Closing & Settlement Automated Tests...\n');

  try {
    // 1. Get Admin user
    const admin = await prisma.user.findFirst({ where: { username: 'admin' } }) || await prisma.user.findFirst();
    if (!admin) throw new Error('No user found');

    const startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // 2. Test getKitchenClosingStatus
    console.log('--- Test 1: Fetch Kitchen Closing Status ---');
    const statusBefore = await reportsService.getKitchenClosingStatus(startDate, endDate);
    console.log(`✅ Kitchen closing status fetched successfully:`);
    console.log(`   - Sandwiches Sold: ${statusBefore.summary.totalSandwichesSold}`);
    console.log(`   - Sandwich Revenue: ${statusBefore.summary.totalSandwichRevenue} EGP`);
    console.log(`   - Base Patty Cost: ${statusBefore.summary.totalBaseCost} EGP`);
    console.log(`   - Total Materials Tracked: ${statusBefore.summary.materialsCount}`);
    console.log(`   - Auxiliary Materials (to settle): ${statusBefore.summary.auxiliaryCount}`);

    const bun = statusBefore.auxiliaryMaterials.find(m => m.name.includes('خبز') || m.name.includes('كايزر') || m.name.includes('فينو'));
    const veg = statusBefore.auxiliaryMaterials.find(m => m.name.includes('طماطم') || m.name.includes('خضار'));

    if (!bun) throw new Error('Auxiliary material (bun) not found in kitchen closing');
    console.log(`   - Found Bun: "${bun.name}", Current Stock: ${bun.currentStock}, Unit Cost: ${bun.unitCost} EGP`);

    // 3. Test settleKitchenMonth
    console.log('\n--- Test 2: Settle Auxiliary Materials by Physical Count ---');
    const initialBunStock = bun.currentStock;
    const consumedBunQty = 5; // Simulating 5 buns consumed in kitchen
    const actualRemainingBun = Math.max(0, initialBunStock - consumedBunQty);

    let itemsToSettle = [
      {
        productId: bun.id,
        actualRemaining: actualRemainingBun,
        reason: 'جرد نهاية الشهر الفعلي لمخبوزات المطبخ'
      }
    ];

    if (veg) {
      const initialVegStock = veg.currentStock;
      const consumedVegQty = 1; // Simulating 1 kg veg consumed
      const actualRemainingVeg = Math.max(0, initialVegStock - consumedVegQty);
      itemsToSettle.push({
        productId: veg.id,
        actualRemaining: actualRemainingVeg,
        reason: 'جرد نهاية الشهر الفعلي للخضار والسلطة'
      });
      console.log(`   - Found Veg: "${veg.name}", Current Stock: ${veg.currentStock}, Target Remaining: ${actualRemainingVeg}`);
    }

    const settlementResult = await reportsService.settleKitchenMonth({
      startDate,
      endDate,
      notes: 'اعتماد تقفيلة المطبخ وجرد الخامات التجريبية',
      items: itemsToSettle
    }, admin.id);

    console.log('✅ Settlement executed successfully:');
    console.log(`   - Total Auxiliary Consumed Cost: ${settlementResult.totalSettledCostConsumed} EGP`);
    console.log(`   - Settled Items Count: ${settlementResult.settledItems.length}`);

    // Verify batch and stock adjustment
    const bunAfter = await prisma.product.findUnique({
      where: { id: bun.id },
      include: { batches: true }
    });
    const newBunStock = bunAfter.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    console.log(`   - Bun Stock after settlement: ${newBunStock} (Expected: ${actualRemainingBun})`);
    if (Math.abs(newBunStock - actualRemainingBun) > 0.001) {
      throw new Error(`FAILED: Bun stock mismatch after settlement. Got: ${newBunStock}, Expected: ${actualRemainingBun}`);
    }

    // Verify InventoryMovement created
    const movement = await prisma.inventoryMovement.findFirst({
      where: {
        productId: bun.id,
        referenceType: 'KITCHEN_SETTLEMENT'
      },
      orderBy: { createdAt: 'desc' }
    });
    if (!movement || movement.type !== 'OUT' || Math.abs(Number(movement.quantity) - consumedBunQty) > 0.001) {
      throw new Error('FAILED: InventoryMovement not created or incorrect quantity');
    }
    console.log(`✅ InventoryMovement verified: type = ${movement.type}, qty = ${movement.quantity}, ref = ${movement.referenceType}`);

    // Verify InventoryCount created
    const countRecord = await prisma.inventoryCount.findFirst({
      where: {
        productId: bun.id
      },
      orderBy: { createdAt: 'desc' }
    });
    if (!countRecord || Math.abs(Number(countRecord.actualQuantity) - actualRemainingBun) > 0.001) {
      throw new Error('FAILED: InventoryCount not created or incorrect actualQuantity');
    }
    console.log(`✅ InventoryCount verified: actual = ${countRecord.actualQuantity}, diff = ${countRecord.difference}`);

    // 4. Test Monthly Financial Report Integration
    console.log('\n--- Test 3: Monthly Financial Report Integration ---');
    const monthlyReport = await reportsService.getDetailedReport('MONTHLY_FINANCIAL', startDate, endDate);
    console.log('✅ Monthly report generated successfully:');
    console.log(`   - Kitchen Settlement Cost: ${monthlyReport.summary.kitchenSettlementCost} EGP`);
    console.log(`   - Total Cost of Goods Sold (COGS): ${monthlyReport.summary.costOfGoodsSold} EGP`);
    console.log(`   - Net Trading Profit: ${monthlyReport.summary.netProfit} EGP`);

    const sandwichDiv = monthlyReport.summary.divisions?.SANDWICH;
    if (sandwichDiv) {
      console.log(`   - Sandwich Division:`);
      console.log(`     * Revenue: ${sandwichDiv.revenue} EGP`);
      console.log(`     * Base Patty Cost: ${sandwichDiv.baseCost} EGP`);
      console.log(`     * Auxiliary Settlement Cost: ${sandwichDiv.auxiliaryCost} EGP`);
      console.log(`     * Total Division Cost: ${sandwichDiv.cost} EGP`);
      console.log(`     * Final Net Profit: ${sandwichDiv.profit} EGP (${sandwichDiv.margin}%)`);

      if (sandwichDiv.auxiliaryCost <= 0) {
        throw new Error('FAILED: Sandwich division auxiliaryCost should be greater than 0 after settlement');
      }
      if (Math.abs(sandwichDiv.cost - (sandwichDiv.baseCost + sandwichDiv.auxiliaryCost)) > 0.01) {
        throw new Error('FAILED: Sandwich division total cost must equal baseCost + auxiliaryCost');
      }
    }

    // 5. Clean up test settlement movements/counts so environment stays pristine
    console.log('\n--- Test 4: Rollback Test Movements and Restore Stock ---');
    // Restore batches
    await prisma.batch.create({
      data: {
        productId: bun.id,
        quantityRemaining: consumedBunQty,
        unitCost: Number(bun.unitCost || 0)
      }
    });
    if (veg) {
      await prisma.batch.create({
        data: {
          productId: veg.id,
          quantityRemaining: 1,
          unitCost: Number(veg.unitCost || 0)
        }
      });
    }
    // Delete the test movements and counts
    await prisma.inventoryMovement.deleteMany({
      where: {
        referenceType: 'KITCHEN_SETTLEMENT',
        id: { gte: movement.id }
      }
    });
    await prisma.inventoryCount.deleteMany({
      where: {
        id: { gte: countRecord.id }
      }
    });
    console.log('✅ Restored test batches and cleaned test movements.');

    console.log('\n🎉 ALL KITCHEN MONTH-END CLOSING TESTS PASSED WITH 100% SUCCESS!');
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
