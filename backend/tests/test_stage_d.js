const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const reportsService = require('../src/features/reports/reports.service');

async function runTest() {
  console.log('=== STARTING STAGE D TESTS (DIVISIONS REPORTS & RAW MATERIALS) ===');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // 1. Test DAILY_FINANCIAL report
  console.log('\n--- 1. Testing DAILY_FINANCIAL Report ---');
  const dailyReport = await reportsService.getDetailedReport('DAILY_FINANCIAL', now.toISOString().split('T')[0], now.toISOString().split('T')[0]);
  
  if (!dailyReport.summary || !dailyReport.summary.divisions) {
    throw new Error('Divisions missing in daily financial summary');
  }

  console.log('Daily Divisions Breakdown:');
  console.log(`- CANTEEN: Revenue=${dailyReport.summary.divisions.CANTEEN.revenue} EGP, Profit=${dailyReport.summary.divisions.CANTEEN.profit} EGP`);
  console.log(`- BUFFET: Revenue=${dailyReport.summary.divisions.BUFFET.revenue} EGP, Profit=${dailyReport.summary.divisions.BUFFET.profit} EGP`);
  console.log(`- SANDWICH: Revenue=${dailyReport.summary.divisions.SANDWICH.revenue} EGP, Profit=${dailyReport.summary.divisions.SANDWICH.profit} EGP`);

  // 2. Test MONTHLY_FINANCIAL report
  console.log('\n--- 2. Testing MONTHLY_FINANCIAL Report ---');
  const monthlyReport = await reportsService.getDetailedReport('MONTHLY_FINANCIAL', startOfMonth.toISOString().split('T')[0], endOfDay.toISOString().split('T')[0]);

  if (!monthlyReport.summary || !monthlyReport.summary.divisions) {
    throw new Error('Divisions missing in monthly financial summary');
  }

  console.log('Monthly Divisions Breakdown:');
  console.log(`- CANTEEN: Revenue=${monthlyReport.summary.divisions.CANTEEN.revenue} EGP, Profit=${monthlyReport.summary.divisions.CANTEEN.profit} EGP`);
  console.log(`- BUFFET: Revenue=${monthlyReport.summary.divisions.BUFFET.revenue} EGP, Profit=${monthlyReport.summary.divisions.BUFFET.profit} EGP`);
  console.log(`- SANDWICH: Revenue=${monthlyReport.summary.divisions.SANDWICH.revenue} EGP, Profit=${monthlyReport.summary.divisions.SANDWICH.profit} EGP`);

  // 3. Test RAW_MATERIALS report
  console.log('\n--- 3. Testing RAW_MATERIALS Report ---');
  const rawReport = await reportsService.getDetailedReport('RAW_MATERIALS', startOfMonth.toISOString().split('T')[0], endOfDay.toISOString().split('T')[0]);

  console.log(`Total Raw Materials: ${rawReport.summary.totalMaterialsCount}`);
  console.log(`Total Value Consumed: ${rawReport.summary.totalRawValueConsumed} EGP`);

  const sugar = rawReport.materials.find(m => m.name.includes('سكر'));
  const teaBags = rawReport.materials.find(m => m.name.includes('شاي'));
  const burgerPatties = rawReport.materials.find(m => m.name.includes('برجر'));

  if (sugar) {
    console.log(`Sugar Consumption: Net=${sugar.netConsumedQty} ${sugar.unit}, Total Cost=${sugar.totalCostConsumed} EGP, Stock=${sugar.currentStock}`);
  }
  if (teaBags) {
    console.log(`Tea Bags Consumption: Net=${teaBags.netConsumedQty} ${teaBags.unit}, Stock=${teaBags.currentStock}`);
  }
  if (burgerPatties) {
    console.log(`Burger Patties Consumption: Net=${burgerPatties.netConsumedQty} ${burgerPatties.unit}, Stock=${burgerPatties.currentStock}`);
  }

  if (rawReport.materials.length === 0) {
    throw new Error('Raw materials list should not be empty');
  }

  console.log('\n✅ ALL STAGE D TESTS PASSED PERFECTLY!');
  await prisma.$disconnect();
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
