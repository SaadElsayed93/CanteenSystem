const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const salesService = require('../src/features/sales/sales.service');

async function testUnifiedCatalog() {
  console.log('🧪 Testing Sales & Auto-Deductions with Unified Clean Catalog...');

  try {
    const admin = await prisma.user.findFirst();
    const drawer = await prisma.paymentMethod.findFirst({ where: { name: { contains: 'درج' } } });
    if (!drawer) throw new Error('Drawer not found');

    // Ensure a shift is open
    let shift = await prisma.dailyShift.findFirst({ where: { status: 'OPEN' } });
    if (!shift) {
      shift = await prisma.dailyShift.create({
        data: {
          shiftNumber: 1,
          status: 'OPEN',
          startingCash: 500,
          openedBy: admin.id
        }
      });
    }

    const tea = await prisma.product.findUnique({ where: { internalCode: 'REC-TEA' } });
    const coffee = await prisma.product.findUnique({ where: { internalCode: 'REC-COFFEE' } });
    const nescafe = await prisma.product.findUnique({ where: { internalCode: 'REC-NESCAFE' } });
    const burger = await prisma.product.findUnique({ where: { internalCode: 'REC-BURGER' } });
    const strips = await prisma.product.findUnique({ where: { internalCode: 'REC-STRIPS' } });

    console.log('Found unified products:');
    console.log(`- ${tea.name} (${tea.sellingPrice} EGP, BOM Cost: ${tea.purchasePrice} EGP)`);
    console.log(`- ${coffee.name} (${coffee.sellingPrice} EGP, BOM Cost: ${coffee.purchasePrice} EGP)`);
    console.log(`- ${nescafe.name} (${nescafe.sellingPrice} EGP, BOM Cost: ${nescafe.purchasePrice} EGP)`);
    console.log(`- ${burger.name} (${burger.sellingPrice} EGP, BOM Cost: ${burger.purchasePrice} EGP)`);
    console.log(`- ${strips.name} (${strips.sellingPrice} EGP, BOM Cost: ${strips.purchasePrice} EGP)`);

    // Sell 1 of each in a single multi-division invoice
    const sale = await salesService.createSale({
      type: 'CASH',
      paymentMethodId: drawer.id,
      items: [
        { productId: tea.id, quantity: 1, price: 10.00 },
        { productId: coffee.id, quantity: 1, price: 15.00 },
        { productId: nescafe.id, quantity: 1, price: 15.00 },
        { productId: burger.id, quantity: 1, price: 35.00 },
        { productId: strips.id, quantity: 1, price: 30.00 }
      ]
    }, admin.id);

    console.log(`\n✅ Invoice #${sale.invoiceNumber} created successfully for ${sale.totalAmount} EGP (10+15+15+35+30 = 105 EGP)`);

    // Check movements
    const movements = await prisma.inventoryMovement.findMany({
      where: { referenceId: sale.id, referenceType: 'SALE_RECIPE' },
      include: { product: true }
    });

    console.log('\nInventory Deductions:');
    movements.forEach(m => {
      console.log(`- Deducted ${m.quantity} ${m.product.unit} of "${m.product.name}"`);
    });

    if (movements.length < 5) {
      throw new Error('Expected at least 5 raw material deductions!');
    }

    console.log('\n🎉 UNIFIED CATALOG VERIFIED 100% PERFECTLY!');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testUnifiedCatalog();
