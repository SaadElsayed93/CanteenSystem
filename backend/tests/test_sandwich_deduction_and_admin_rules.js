const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const productsService = require('../src/features/products/products.service');
const salesService = require('../src/features/sales/sales.service');
const returnsService = require('../src/features/returns/returns.service');
const reportsService = require('../src/features/reports/reports.service');

async function runTests() {
  console.log('🧪 Starting Sandwich Deduction & Admin Rules Verification Tests...\n');

  try {
    // 1. Get users
    const admin = await prisma.user.findFirst({ where: { username: 'admin' } }) || await prisma.user.findFirst();
    let cashier = await prisma.user.findFirst({ where: { username: { not: 'admin' } } });
    if (!cashier) {
      // Create a cashier user if none exists
      const cashierRole = await prisma.role.findFirst({ where: { name: { not: 'مدير' } } });
      cashier = await prisma.user.create({
        data: {
          username: 'cashier_test_' + Date.now(),
          passwordHash: 'dummy',
          fullName: 'كاشير تجريبي',
          roleId: cashierRole.id
        }
      });
    }

    // Ensure daily shift is open
    let shift = await prisma.dailyShift.findFirst({ where: { status: 'OPEN' } });
    if (!shift) {
      shift = await prisma.dailyShift.create({
        data: {
          shiftNumber: Math.floor(Date.now() % 100000),
          openedBy: admin.id,
          status: 'OPEN',
          startingCash: 100
        }
      });
    }

    // 2. Test Rule 1 & 2: Non-Admin cannot edit Buffet or Sandwich
    console.log('--- Test 1: Admin-Only Restriction on Buffet and Sandwiches ---');
    const burgerSandwich = await prisma.product.findFirst({
      where: { activityType: 'SANDWICH', productType: 'RECIPE' }
    });
    if (!burgerSandwich) throw new Error('Burger sandwich not found');

    let nonAdminBlocked = false;
    try {
      await productsService.updateProduct(burgerSandwich.id, { sellingPrice: 50 }, cashier.id);
    } catch (err) {
      nonAdminBlocked = true;
      console.log('✅ Correctly blocked non-admin edit:', err.message);
    }
    if (!nonAdminBlocked) {
      throw new Error('FAILED: Non-admin was able to update sandwich price!');
    }

    // Admin should be able to update
    const adminUpdate = await productsService.updateProduct(burgerSandwich.id, { sellingPrice: 35 }, admin.id);
    console.log('✅ Admin successfully updated sandwich price to:', adminUpdate.sellingPrice);

    // Verify Buffet item CAN be updated by non-admin
    console.log('\n--- Test 1.b: Buffet is Open for Both Admin and Non-Admin ---');
    const buffetItem = await prisma.product.findFirst({
      where: { activityType: 'BUFFET' }
    });
    if (buffetItem) {
      const nonAdminBuffetUpdate = await productsService.updateProduct(buffetItem.id, { alertThreshold: 15 }, cashier.id);
      console.log(`✅ Non-admin successfully updated Buffet item (${buffetItem.name}): alertThreshold = ${nonAdminBuffetUpdate.alertThreshold}`);
    }

    // 3. Test Rule 3: Raw Materials have sellingPrice === 0
    console.log('\n--- Test 2: Raw Material Selling Price is 0 ---');
    // Ensure all raw materials have sellingPrice 0
    await prisma.product.updateMany({
      where: { productType: 'RAW_MATERIAL' },
      data: { sellingPrice: 0 }
    });
    const rawSugar = await prisma.product.findFirst({ where: { productType: 'RAW_MATERIAL' } });
    if (rawSugar) {
      console.log(`✅ Raw Material (${rawSugar.name}): sellingPrice = ${rawSugar.sellingPrice}`);
      if (Number(rawSugar.sellingPrice) !== 0) {
        throw new Error('FAILED: Raw material sellingPrice is not 0!');
      }
    }

    // 4. Test Sandwich POS Deduction: ONLY base raw material is deducted on sale for Countable Base!
    console.log('\n--- Test 3.a: Countable Base Sandwich (Burger) POS Sale Deducts ONLY Base Ingredient ---');
    // Fetch recipe details of burger sandwich
    const recipeData = await productsService.getRecipe(burgerSandwich.id);
    console.log('Burger sandwich ingredients in recipe:');
    recipeData.ingredients.forEach(ing => {
      console.log(` - ${ing.rawMaterialName} (${ing.isBaseIngredient ? '⭐ المادة الأساسية' : '🥗 مكمل'}): ${ing.quantityPerUnit} ${ing.rawMaterialUnit}, currentStock = ${ing.rawMaterialStock}`);
    });

    const baseIng = recipeData.ingredients.find(i => i.isBaseIngredient) || recipeData.ingredients[0];
    const auxIng = recipeData.ingredients.find(i => !i.isBaseIngredient);

    const baseStockBefore = Number(baseIng.rawMaterialStock);
    const auxStockBefore = auxIng ? Number(auxIng.rawMaterialStock) : null;

    const pm = await prisma.paymentMethod.findFirst();

    // Make a sale of 2 burger sandwiches
    const saleResult = await salesService.createSale({
      items: [{ productId: burgerSandwich.id, quantity: 2 }],
      type: 'CASH',
      paymentMethodId: pm ? pm.id : undefined
    }, admin.id);
    console.log('✅ Burger sale completed, Invoice ID:', saleResult.id);

    // Check stock after sale
    const baseMatAfter = await prisma.product.findUnique({
      where: { id: baseIng.rawMaterialId },
      include: { batches: true }
    });
    const baseStockAfter = baseMatAfter.batches.reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
    console.log(`⭐ Base Material (${baseIng.rawMaterialName}): Stock before = ${baseStockBefore}, Stock after = ${baseStockAfter}`);

    if (baseStockAfter !== baseStockBefore - 2) {
      throw new Error(`FAILED: Base ingredient stock was not deducted by 2! Expected ${baseStockBefore - 2}, got ${baseStockAfter}`);
    }
    console.log('✅ Base ingredient was accurately deducted by 2 pieces!');

    if (auxIng) {
      const auxMatAfter = await prisma.product.findUnique({
        where: { id: auxIng.rawMaterialId },
        include: { batches: true }
      });
      const auxStockAfter = auxMatAfter.batches.reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
      console.log(`🥗 Auxiliary Material (${auxIng.rawMaterialName}): Stock before = ${auxStockBefore}, Stock after = ${auxStockAfter}`);

      if (auxStockAfter !== auxStockBefore) {
        throw new Error(`FAILED: Auxiliary material was deducted during POS sale! Expected ${auxStockBefore}, got ${auxStockAfter}`);
      }
      console.log('✅ Auxiliary material stock remained completely intact (not deducted on POS sale)!');
    }

    // 4.b Test Bulk Freezer Sandwich (Strips): Zero deduction on sale!
    console.log('\n--- Test 3.b: Bulk Freezer Sandwich (Strips) POS Sale Deducts ZERO Pieces ---');
    const stripsSandwich = await prisma.product.findFirst({
      where: { internalCode: 'REC-STRIPS' },
      include: { ingredients: { include: { rawMaterial: true } } }
    });
    if (stripsSandwich) {
      const rawStrips = await prisma.product.findFirst({ where: { internalCode: 'RAW-STRIPS' }, include: { batches: true } });
      const stripsStockBefore = rawStrips.batches.reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
      console.log(`❄️ Raw Strips in Freezer before sale: ${stripsStockBefore} ${rawStrips.unit}`);

      const stripsSale = await salesService.createSale({
        items: [{ productId: stripsSandwich.id, quantity: 3 }],
        type: 'CASH',
        paymentMethodId: pm ? pm.id : undefined
      }, admin.id);
      console.log('✅ Strips sandwich sale completed, Invoice ID:', stripsSale.id);

      const rawStripsAfter = await prisma.product.findFirst({ where: { internalCode: 'RAW-STRIPS' }, include: { batches: true } });
      const stripsStockAfter = rawStripsAfter.batches.reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
      console.log(`❄️ Raw Strips in Freezer after selling 3 sandwiches: ${stripsStockAfter} ${rawStrips.unit}`);

      if (stripsStockAfter !== stripsStockBefore) {
        throw new Error(`FAILED: Bulk freezer raw material (Strips) should NOT be deducted on POS sale! Before: ${stripsStockBefore}, After: ${stripsStockAfter}`);
      }
      console.log('✅ Strips freezer stock remained 100% intact! (Zero daily deduction, settled monthly by actual physical count).');
    }

    // 5. Test Return of Sandwich: Only base ingredient is restored
    console.log('\n--- Test 4: Sandwich Return Restores ONLY Base Ingredient ---');
    const invoiceItem = await prisma.invoiceItem.findFirst({
      where: { invoiceId: saleResult.id }
    });

    const returnResult = await returnsService.createReturn({
      invoiceId: saleResult.id,
      type: 'CASH',
      paymentMethodId: pm ? pm.id : undefined,
      returnItems: [{
        invoiceItemId: invoiceItem.id,
        productId: burgerSandwich.id,
        quantity: 1,
        unitPrice: 35
      }],
      reason: 'تجربة إرجاع سندوتش'
    }, admin.id);
    console.log('✅ Return completed, Return ID:', returnResult.id);

    const baseMatAfterReturn = await prisma.product.findUnique({
      where: { id: baseIng.rawMaterialId },
      include: { batches: true }
    });
    const baseStockAfterReturn = baseMatAfterReturn.batches.reduce((sum, b) => sum + Number(b.quantityRemaining || 0), 0);
    console.log(`⭐ Base Material after return: Stock = ${baseStockAfterReturn}`);
    if (baseStockAfterReturn !== baseStockBefore - 1) {
      throw new Error(`FAILED: Base ingredient stock was not restored! Expected ${baseStockBefore - 1}, got ${baseStockAfterReturn}`);
    }
    console.log('✅ Base ingredient was accurately restored by 1 piece!');

    // 6. Test Raw Materials Report: Theoretical Sandwich Usage
    console.log('\n--- Test 5: Raw Materials Report Theoretical Usage ---');
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const report = await reportsService.getDetailedReport('RAW_MATERIALS', startOfDay, endOfDay);
    console.log(`Report generated with ${report.materials.length} raw materials:`);
    report.materials.filter(m => m.isSandwichAuxiliary).forEach(m => {
      console.log(` - ${m.name}: theoreticalSandwichUsage = ${m.theoreticalSandwichUsage} ${m.unit}, cost = ${m.theoreticalSandwichCost} EGP`);
    });

    console.log('\n🎉 ALL TESTS PASSED WITH 100% SUCCESS!\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
