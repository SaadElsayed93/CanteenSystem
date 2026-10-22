const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const reportsService = require('../src/features/reports/reports.service');

async function testSegmentedReports() {
  console.log('--- Testing Segmented Sales Reports ---');

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Test DAILY_FINANCIAL
  console.log('Testing DAILY_FINANCIAL report...');
  const dailyReport = await reportsService.getDetailedReport('DAILY_FINANCIAL', todayStr, todayStr);
  console.log(`Daily report products count: ${dailyReport.products ? dailyReport.products.length : 0}`);
  if (dailyReport.products && dailyReport.products.length > 0) {
    const p = dailyReport.products[0];
    console.log('Sample daily product:', {
      name: p.name,
      activityType: p.activityType,
      quantity: p.quantity,
      revenue: p.revenue,
      cost: p.cost,
      profit: p.profit
    });
    if (!p.activityType) throw new Error('activityType missing on daily product');
  }

  // 2. Test MONTHLY_FINANCIAL
  console.log('Testing MONTHLY_FINANCIAL report...');
  const firstDayStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const monthlyReport = await reportsService.getDetailedReport('MONTHLY_FINANCIAL', firstDayStr, todayStr);
  console.log(`Monthly report products count: ${monthlyReport.products ? monthlyReport.products.length : 0}`);
  if (monthlyReport.products && monthlyReport.products.length > 0) {
    const p = monthlyReport.products[0];
    console.log('Sample monthly product:', {
      name: p.name,
      activityType: p.activityType,
      quantity: p.quantity,
      revenue: p.revenue,
      cost: p.cost,
      profit: p.profit
    });
    if (!p.activityType) throw new Error('activityType missing on monthly product');
  }

  // 3. Test SALES
  console.log('Testing SALES report...');
  const salesReport = await reportsService.getDetailedReport('SALES', firstDayStr, todayStr);
  console.log(`Sales report items count: ${salesReport.data ? salesReport.data.length : 0}`);
  if (salesReport.data && salesReport.data.length > 0) {
    const p = salesReport.data[0];
    console.log('Sample sales product:', {
      name: p.name,
      activityType: p.activityType,
      quantity: p.quantity,
      revenue: p.revenue,
      cost: p.cost,
      profit: p.profit
    });
    if (!p.activityType) throw new Error('activityType missing on sales product');
  }

  console.log('✅ ALL SEGMENTED REPORTS TESTS PASSED SUCCESSFULLY!');
}

testSegmentedReports()
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
