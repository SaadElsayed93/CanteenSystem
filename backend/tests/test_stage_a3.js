const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const salesService = require('../src/features/sales/sales.service');
const returnsService = require('../src/features/returns/returns.service');
const productsService = require('../src/features/products/products.service');

async function runTest() {
  console.log('=== STARTING SUB-STAGE A.3 TESTS ===');

  const admin = await prisma.user.findFirst();
  if (!admin) throw new Error('No admin user');

  // Ensure an open shift
  let activeShift = await prisma.dailyShift.findFirst({ where: { status: 'OPEN' } });
  if (!activeShift) {
    activeShift = await prisma.dailyShift.create({
      data: {
        shiftNumber: `SHIFT-${Date.now()}`,
        openedBy: admin.id,
        initialBalance: 1000,
        status: 'OPEN'
      }
    });
    console.log(`Opened new daily shift: #${activeShift.id}`);
  }

  // Ensure payment method
  let paymentMethod = await prisma.paymentMethod.findFirst({ where: { isActive: true } });
  if (!paymentMethod) {
    paymentMethod = await prisma.paymentMethod.create({
      data: { name: 'الخزينة الرئيسية', code: 'CASH', type: 'CASH', currentBalance: 5000 }
    });
  }

  // Fetch recipe items and raw materials
  const teaRecipe = await prisma.product.findUnique({
    where: { internalCode: 'REC-TEA-01' },
    include: { ingredients: { include: { rawMaterial: true } } }
  });
  if (!teaRecipe) throw new Error('REC-TEA-01 recipe not found. Run A.2 first.');

  const burgerRecipe = await prisma.product.findUnique({
    where: { internalCode: 'REC-BURGER-01' },
    include: { ingredients: { include: { rawMaterial: true } } }
  });
  if (!burgerRecipe) throw new Error('REC-BURGER-01 recipe not found. Run A.2 first.');

  const sugarRaw = await prisma.product.findUnique({ where: { internalCode: 'RAW-SUGAR' } });
  const teaBagsRaw = await prisma.product.findUnique({ where: { internalCode: 'RAW-TEA' } });
  const cupsRaw = await prisma.product.findUnique({ where: { internalCode: 'RAW-CUP' } });
  const burgerPattiesRaw = await prisma.product.findUnique({ where: { internalCode: 'RAW-BURGER' } });
  const bunsRaw = await prisma.product.findUnique({ where: { internalCode: 'RAW-BUN' } });
  const tomatoesRaw = await prisma.product.findUnique({ where: { internalCode: 'RAW-TOMATO' } });

  const getStock = async (id) => {
    const batches = await prisma.batch.findMany({ where: { productId: id } });
    return batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
  };

  const sugarStockBefore = await getStock(sugarRaw.id);
  const teaBagsStockBefore = await getStock(teaBagsRaw.id);
  const cupsStockBefore = await getStock(cupsRaw.id);

  console.log('\n--- Initial Raw Stock Before Tea Sale ---');
  console.log(`Sugar: ${sugarStockBefore} kg`);
  console.log(`Tea Bags: ${teaBagsStockBefore} bags`);
  console.log(`Cups: ${cupsStockBefore} cups`);

  // 1. Sell 5 cups of Tea
  const sale1 = await salesService.createSale({
    type: 'CASH',
    paymentMethodId: paymentMethod.id,
    items: [
      { productId: teaRecipe.id, quantity: 5 }
    ]
  }, admin.id);

  console.log(`\nCreated Tea Sale Invoice #${sale1.invoiceNumber} for 5 cups.`);

  const sugarStockAfterSale = await getStock(sugarRaw.id);
  const teaBagsStockAfterSale = await getStock(teaBagsRaw.id);
  const cupsStockAfterSale = await getStock(cupsRaw.id);

  console.log('\n--- Raw Stock After 5 Cups Sold ---');
  console.log(`Sugar: ${sugarStockAfterSale} kg (Expected: ${sugarStockBefore - 0.1})`);
  console.log(`Tea Bags: ${teaBagsStockAfterSale} (Expected: ${teaBagsStockBefore - 5})`);
  console.log(`Cups: ${cupsStockAfterSale} (Expected: ${cupsStockBefore - 5})`);

  if (Math.abs(sugarStockAfterSale - (sugarStockBefore - 0.1)) > 0.001) throw new Error('Sugar stock mismatch after sale');
  if (teaBagsStockAfterSale !== teaBagsStockBefore - 5) throw new Error('Tea bags stock mismatch after sale');
  if (cupsStockAfterSale !== cupsStockBefore - 5) throw new Error('Cups stock mismatch after sale');

  // Verify inventory movements
  const teaSaleMovements = await prisma.inventoryMovement.findMany({
    where: { referenceId: sale1.id, referenceType: 'SALE_RECIPE' }
  });
  console.log(`Logged ${teaSaleMovements.length} raw material SALE_RECIPE movements.`);
  if (teaSaleMovements.length !== 3) throw new Error('Expected 3 SALE_RECIPE movements');

  // 2. Test Return: Return 2 cups of tea
  const fullSale1 = await prisma.invoice.findUnique({
    where: { id: sale1.id },
    include: { items: true }
  });
  const teaInvoiceItem = fullSale1.items.find(i => i.productId === teaRecipe.id);

  const return1 = await returnsService.createReturn({
    invoiceId: sale1.id,
    type: 'PARTIAL',
    reason: 'طلب العميل إلغاء كوبين',
    paymentMethodId: paymentMethod.id,
    returnItems: [
      {
        invoiceItemId: teaInvoiceItem.id,
        productId: teaRecipe.id,
        quantity: 2,
        unitPrice: teaRecipe.sellingPrice
      }
    ]
  }, admin.id);

  console.log(`\nProcessed Return #${return1.id} for 2 cups.`);

  const sugarStockAfterReturn = await getStock(sugarRaw.id);
  const teaBagsStockAfterReturn = await getStock(teaBagsRaw.id);
  const cupsStockAfterReturn = await getStock(cupsRaw.id);

  console.log('\n--- Raw Stock After Returning 2 Cups ---');
  console.log(`Sugar: ${sugarStockAfterReturn} kg (Expected: ${sugarStockBefore - 0.06})`);
  console.log(`Tea Bags: ${teaBagsStockAfterReturn} (Expected: ${teaBagsStockBefore - 3})`);
  console.log(`Cups: ${cupsStockAfterReturn} (Expected: ${cupsStockBefore - 3})`);

  if (Math.abs(sugarStockAfterReturn - (sugarStockBefore - 0.06)) > 0.001) throw new Error('Sugar stock mismatch after return');
  if (teaBagsStockAfterReturn !== teaBagsStockBefore - 3) throw new Error('Tea bags stock mismatch after return');
  if (cupsStockAfterReturn !== cupsStockBefore - 3) throw new Error('Cups stock mismatch after return');

  // 3. Test Sandwich Sale (سندوتش برجر)
  const burgerStockBefore = await getStock(burgerPattiesRaw.id);
  const bunStockBefore = await getStock(bunsRaw.id);
  const tomatoStockBefore = await getStock(tomatoesRaw.id);

  const sale2 = await salesService.createSale({
    type: 'CASH',
    paymentMethodId: paymentMethod.id,
    items: [
      { productId: burgerRecipe.id, quantity: 2 }
    ]
  }, admin.id);

  console.log(`\nCreated Burger Sale Invoice #${sale2.invoiceNumber} for 2 sandwiches.`);

  const burgerStockAfter = await getStock(burgerPattiesRaw.id);
  const bunStockAfter = await getStock(bunsRaw.id);
  const tomatoStockAfter = await getStock(tomatoesRaw.id);

  console.log('\n--- Sandwich Raw Stock After 2 Burgers Sold ---');
  console.log(`Burger Patties: ${burgerStockAfter} (Expected: ${burgerStockBefore - 2})`);
  console.log(`Buns: ${bunStockAfter} (Expected: ${bunStockBefore - 2})`);
  console.log(`Tomatoes: ${tomatoStockAfter} kg (Expected: ${tomatoStockBefore - 0.1})`);

  if (burgerStockAfter !== burgerStockBefore - 2) throw new Error('Burger patties mismatch');
  if (bunStockAfter !== bunStockBefore - 2) throw new Error('Buns mismatch');
  if (Math.abs(tomatoStockAfter - (tomatoStockBefore - 0.1)) > 0.001) throw new Error('Tomatoes mismatch');

  // 4. Test getPosData()
  const posData = await salesService.getPosData();
  const posTea = posData.products.find(p => p.id === teaRecipe.id);
  const posBurger = posData.products.find(p => p.id === burgerRecipe.id);

  console.log('\n--- POS Data Verification ---');
  console.log(`Tea in POS: Activity=${posTea.activityType}, Type=${posTea.productType}, TotalStock=${posTea.totalStock}`);
  console.log(`Burger in POS: Activity=${posBurger.activityType}, Type=${posBurger.productType}, TotalStock=${posBurger.totalStock}`);

  if (posTea.activityType !== 'BUFFET' || posTea.productType !== 'RECIPE') throw new Error('Tea POS activity/type mismatch');
  if (posBurger.activityType !== 'SANDWICH' || posBurger.productType !== 'RECIPE') throw new Error('Burger POS activity/type mismatch');
  if (posBurger.totalStock !== 18) throw new Error(`Expected burger stock 18, got ${posBurger.totalStock}`);

  console.log('\n✅ ALL SUB-STAGE A.3 TESTS PASSED PERFECTLY!');
  await prisma.$disconnect();
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
