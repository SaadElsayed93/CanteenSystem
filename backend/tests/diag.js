const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  console.log('=== CANTEEN SYSTEM COMPLETE AUDIT DIAGNOSTIC ===');

  const [products, rawMats, recipes, users, shifts, invoices, returns, patients, suppliers, purchases, movements, batches] = await Promise.all([
    prisma.product.count({ where: { productType: 'SIMPLE' } }),
    prisma.product.count({ where: { productType: 'RAW_MATERIAL' } }),
    prisma.product.count({ where: { productType: 'RECIPE' } }),
    prisma.user.count(),
    prisma.dailyShift.count(),
    prisma.invoice.count(),
    prisma.return.count(),
    prisma.patient.count(),
    prisma.supplier.count(),
    prisma.supplierPurchase.count(),
    prisma.inventoryMovement.count(),
    prisma.batch.count()
  ]);

  console.log('Counts:', { products, rawMats, recipes, users, shifts, invoices, returns, patients, suppliers, purchases, movements, batches });

  // 1. Product Distribution
  const activities = await prisma.product.groupBy({
    by: ['activityType', 'productType'],
    _count: { id: true }
  });
  console.log('\n--- Product Distribution ---');
  activities.forEach(a => {
    console.log(`  - Activity: ${a.activityType.padEnd(10)} | Type: ${a.productType.padEnd(12)} | Count: ${a._count.id}`);
  });

  // 2. Check Raw Materials Selling Prices (Should be 0 as per user rule)
  const nonZeroRaw = await prisma.product.findMany({
    where: { productType: 'RAW_MATERIAL', sellingPrice: { gt: 0 } }
  });
  console.log(`\n--- Raw Materials with sellingPrice > 0: ${nonZeroRaw.length} ---`);
  nonZeroRaw.forEach(r => console.log(`  - [Warning] ID: ${r.id}, Name: ${r.name}, sellingPrice: ${r.sellingPrice}`));

  // 3. Check Tea, Sugar, Coffee items in DB
  const buffetRaw = await prisma.product.findMany({
    where: { 
      activityType: 'BUFFET',
      productType: 'RAW_MATERIAL'
    }
  });
  console.log(`\n--- Buffet Raw Materials (${buffetRaw.length} items): ---`);
  buffetRaw.forEach(r => console.log(`  - ID: ${r.id}, Code: ${r.internalCode}, Name: ${r.name}, Price: ${r.purchasePrice}, Unit: ${r.unit}`));

  // 4. Check Hot Drinks (Recipes)
  const buffetRecipes = await prisma.product.findMany({
    where: { activityType: 'BUFFET', productType: 'RECIPE' },
    include: { ingredients: { include: { rawMaterial: true } } }
  });
  console.log(`\n--- Buffet Hot Drinks Recipes (${buffetRecipes.length} recipes): ---`);
  buffetRecipes.forEach(rec => {
    const ingNames = rec.ingredients.map(i => `${i.rawMaterial?.name} (${i.quantityPerUnit})`).join(', ');
    console.log(`  - ID: ${rec.id}, Name: ${rec.name}, Price: ${rec.sellingPrice}, Recipe: [${ingNames}]`);
  });

  // 5. Check Sandwich Recipes & Dual Costing flags
  const sandwichRecipes = await prisma.product.findMany({
    where: { activityType: 'SANDWICH', productType: 'RECIPE' },
    include: { ingredients: { include: { rawMaterial: true } } }
  });
  console.log(`\n--- Sandwich Recipes (${sandwichRecipes.length} sandwiches): ---`);
  sandwichRecipes.forEach(rec => {
    const isBulk = rec.recipeNotes?.includes('MONTHLY_SETTLEMENT') || rec.ingredients.some(i => i.notes?.includes('تسوية') || i.notes?.includes('مفتوح'));
    console.log(`  - ID: ${rec.id}, Name: ${rec.name}, Price: ${rec.sellingPrice}, CostingMode: ${isBulk ? '❄️ BULK_SETTLEMENT' : '🥩 COUNTABLE_PIECE'}`);
  });

  // 6. Check Batches with negative stock
  const negativeBatches = await prisma.batch.findMany({
    where: { quantityRemaining: { lt: 0 } },
    include: { product: true }
  });
  console.log(`\n--- Negative Batches: ${negativeBatches.length} ---`);
  negativeBatches.forEach(b => console.log(`  - Product: ${b.product.name}, Remaining: ${b.quantityRemaining}, UnitCost: ${b.unitCost}`));

  // 7. Check Patient Debts & Balances
  const patientsWithDebt = await prisma.patient.findMany({
    where: { currentDebt: { not: 0 } }
  });
  console.log(`\n--- Patients with Non-Zero Debt: ${patientsWithDebt.length} ---`);

  // 8. Check Active Daily Shifts
  const openShifts = await prisma.dailyShift.findMany({
    where: { status: 'OPEN' },
    include: { userOpened: true }
  });
  console.log(`\n--- Currently Open Shifts: ${openShifts.length} ---`);
  openShifts.forEach(s => console.log(`  - Shift #${s.shiftNumber}, OpenedBy: ${s.userOpened.fullName}, StartingCash: ${s.startingCash}`));

  // 9. Check Treasury Balances
  const pms = await prisma.paymentMethod.findMany({
    include: { treasuryTransactions: true }
  });
  console.log('\n--- Treasury Balances ---');
  pms.forEach(pm => {
    const bal = pm.treasuryTransactions.reduce((acc, tx) => acc + (tx.type === 'IN' ? Number(tx.amount) : -Number(tx.amount)), 0);
    console.log(`  - Method: ${pm.name.padEnd(15)} | Current Balance: ${Number(pm.currentBalance).toFixed(2)} | Calculated Bal: ${bal.toFixed(2)} | Match: ${Number(pm.currentBalance).toFixed(2) === bal.toFixed(2) ? '✅' : '❌'}`);
  });

  // 10. Check Settings (Backups, Kitchen Closings, etc.)
  const settings = await prisma.setting.findMany();
  console.log(`\n--- System Settings (${settings.length} items): ---`);
  settings.forEach(s => console.log(`  - Key: ${s.key.padEnd(25)} | Value: ${s.value.length > 50 ? s.value.substring(0, 50) + '...' : s.value}`));
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
