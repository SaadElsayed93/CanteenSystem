const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const purchasesService = require('../src/features/purchases/purchases.service');
const reportsService = require('../src/features/reports/reports.service');

async function testPurchaseItemExpiry() {
  console.log('🧪 Starting Purchase Invoice Individual Item Expiry Test...');

  // 1. Get or create a supplier
  let supplier = await prisma.supplier.findFirst({ where: { isActive: true } });
  if (!supplier) {
    supplier = await prisma.supplier.create({
      data: {
        name: 'مورد اختبار الصلاحية',
        company: 'شركة التوريدات للاختبار',
        phone: '01000000000',
        isActive: true
      }
    });
  }

  // 2. Get 3 simple products
  const products = await prisma.product.findMany({
    where: { productType: 'SIMPLE', isActive: true },
    take: 3
  });

  if (products.length < 3) {
    throw new Error('Need at least 3 simple products to run test');
  }

  const [p1, p2, p3] = products;

  // 3. Create purchase with individual expiry dates for each item
  const expiryDate1 = '2027-05-15';
  const expiryDate2 = '2027-11-20';
  const refNo = `TEST-EXP-PUR-${Date.now()}`;

  console.log(`\nCreating purchase with 3 items:`);
  console.log(`  - Item 1: ${p1.name} with expiry ${expiryDate1}`);
  console.log(`  - Item 2: ${p2.name} with expiry ${expiryDate2}`);
  console.log(`  - Item 3: ${p3.name} with NO expiry (optional)`);

  const purchase = await purchasesService.createPurchase({
    supplierId: supplier.id,
    referenceNo: refNo,
    paidAmount: 0,
    items: [
      {
        productId: p1.id,
        quantity: 10,
        unitCost: 15,
        expiryDate: expiryDate1
      },
      {
        productId: p2.id,
        quantity: 5,
        unitCost: 25,
        expiryDate: expiryDate2
      },
      {
        productId: p3.id,
        quantity: 8,
        unitCost: 30,
        expiryDate: null // Optional / omitted
      }
    ]
  }, 1);

  console.log(`✅ Purchase created successfully with ID: ${purchase.id}`);

  // 4. Test getPurchaseById
  const fetchedPurchase = await purchasesService.getPurchaseById(purchase.id);
  console.log(`\nVerifying fetched purchase items:`);

  const fetchedItem1 = fetchedPurchase.items.find(i => i.productId === p1.id);
  const fetchedItem2 = fetchedPurchase.items.find(i => i.productId === p2.id);
  const fetchedItem3 = fetchedPurchase.items.find(i => i.productId === p3.id);

  console.log(`  - Item 1 expiry:`, fetchedItem1?.expiryDate);
  console.log(`  - Item 2 expiry:`, fetchedItem2?.expiryDate);
  console.log(`  - Item 3 expiry:`, fetchedItem3?.expiryDate);

  if (!fetchedItem1?.expiryDate || !fetchedItem1.expiryDate.toISOString().startsWith('2027-05-15')) {
    throw new Error(`Item 1 expiry date mismatch: expected 2027-05-15, got ${fetchedItem1?.expiryDate}`);
  }
  if (!fetchedItem2?.expiryDate || !fetchedItem2.expiryDate.toISOString().startsWith('2027-11-20')) {
    throw new Error(`Item 2 expiry date mismatch: expected 2027-11-20, got ${fetchedItem2?.expiryDate}`);
  }
  if (fetchedItem3?.expiryDate !== null) {
    throw new Error(`Item 3 expiry date mismatch: expected null, got ${fetchedItem3?.expiryDate}`);
  }

  // 5. Test Supplier Statement Timeline
  const statement = await purchasesService.getSupplierStatement(supplier.id);
  const timelineEntry = statement.entries.find(t => t.purchaseId === purchase.id);
  if (!timelineEntry || !timelineEntry.items) {
    throw new Error('Timeline entry or items not found in supplier statement');
  }

  const sItem1 = timelineEntry.items.find(i => i.productName === p1.name);
  const sItem2 = timelineEntry.items.find(i => i.productName === p2.name);
  const sItem3 = timelineEntry.items.find(i => i.productName === p3.name);

  if (!sItem1?.expiryDate || !sItem1.expiryDate.toISOString().startsWith('2027-05-15')) {
    throw new Error('Statement item 1 expiry mismatch');
  }
  if (!sItem2?.expiryDate || !sItem2.expiryDate.toISOString().startsWith('2027-11-20')) {
    throw new Error('Statement item 2 expiry mismatch');
  }
  if (sItem3?.expiryDate !== null) {
    throw new Error('Statement item 3 should have null expiry');
  }

  // 6. Test Reports Service Detailed Purchases Report
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const report = await reportsService.getDetailedReport('PURCHASES', startOfDay, endOfDay, { supplierId: supplier.id });
  const repPurchase = report.data.find(d => d.purchaseId === purchase.id);
  if (!repPurchase) {
    throw new Error('Purchase not found in detailed purchases report');
  }

  const repItem1 = repPurchase.items.find(i => i.productName === p1.name);
  const repItem2 = repPurchase.items.find(i => i.productName === p2.name);
  const repItem3 = repPurchase.items.find(i => i.productName === p3.name);

  if (!repItem1?.expiryDate || !repItem1.expiryDate.toISOString().startsWith('2027-05-15')) {
    throw new Error('Report item 1 expiry mismatch');
  }
  if (!repItem2?.expiryDate || !repItem2.expiryDate.toISOString().startsWith('2027-11-20')) {
    throw new Error('Report item 2 expiry mismatch');
  }
  if (repItem3?.expiryDate !== null) {
    throw new Error('Report item 3 should have null expiry');
  }

  console.log(`\n🎉 ALL INDIVIDUAL PURCHASE ITEM EXPIRY TESTS PASSED 100%!`);
}

testPurchaseItemExpiry()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  });
