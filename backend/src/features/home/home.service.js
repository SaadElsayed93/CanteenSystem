const reportsService = require('../reports/reports.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getHomeDashboardData = async (userId, userRole) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // 1. Low Stock Items (For Sales/Purchases)
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { batches: true }
  });

  const lowStockItems = [];
  let inventoryValue = 0;

  products.forEach(p => {
    const totalQty = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    inventoryValue += totalQty * Number(p.purchasePrice);
    if (totalQty <= Number(p.alertThreshold) || totalQty === 0) {
      lowStockItems.push({ id: p.id, name: p.name, quantity: totalQty, alertThreshold: p.alertThreshold });
    }
  });

  // 2. Shift Stats (Today's Cash Flow)
  // Cash Sales
  const todayCashSales = await prisma.invoice.aggregate({
    where: { createdAt: { gte: today }, status: 'COMPLETED', paymentType: 'CASH' },
    _sum: { totalAmount: true }
  });
  
  // Cash Patient Deposits
  const todayDeposits = await prisma.patientTransaction.aggregate({
    where: { createdAt: { gte: today }, type: 'DEPOSIT' }, // Assuming all deposits are cash
    _sum: { amount: true }
  });

  // Cash Expenses
  const cashPaymentMethod = await prisma.paymentMethod.findFirst({ where: { name: 'نقدي' } });
  let todayExpenses = { _sum: { amount: 0 } };
  let todayPurchasesPaid = { _sum: { paidAmount: 0 } };
  
  if (cashPaymentMethod) {
    todayExpenses = await prisma.expense.aggregate({
      where: { createdAt: { gte: today }, paymentMethodId: cashPaymentMethod.id },
      _sum: { amount: true }
    });

    todayPurchasesPaid = await prisma.supplierPurchase.aggregate({
      where: { createdAt: { gte: today }, paymentMethodId: cashPaymentMethod.id },
      _sum: { paidAmount: true }
    });
  }

  const cashIn = Number(todayCashSales._sum.totalAmount || 0) + Number(todayDeposits._sum.amount || 0);
  const cashOut = Number(todayExpenses._sum.amount || 0) + Number(todayPurchasesPaid._sum.paidAmount || 0);
  const expectedCash = cashIn - cashOut;

  const shiftStats = {
    sales: Number(todayCashSales._sum.totalAmount || 0),
    deposits: Number(todayDeposits._sum.amount || 0),
    expenses: Number(todayExpenses._sum.amount || 0),
    purchases: Number(todayPurchasesPaid._sum.paidAmount || 0),
    expectedCash
  };

  // 3. Admin Stats
  // Patient Debts (Negative balance: what patients owe to the canteen)
  const debts = await prisma.patient.aggregate({
    where: { currentDebt: { lt: 0 } },
    _sum: { currentDebt: true }
  });

  // Patient Deposits (Positive balance: liabilities/deposits owed to patients upon discharge)
  const deposits = await prisma.patient.aggregate({
    where: { currentDebt: { gt: 0 } },
    _sum: { currentDebt: true }
  });
  
  const topDebtors = await prisma.patient.findMany({
    where: { currentDebt: { lt: 0 } },
    orderBy: { currentDebt: 'asc' }, // most negative first
    take: 5,
    select: { id: true, fullName: true, currentDebt: true }
  });

  // Monthly Net Profit
  const monthInvoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: startOfMonth }, status: 'COMPLETED' },
    include: { items: { include: { product: true } } }
  });

  let monthRevenue = 0;
  let monthCost = 0;
  monthInvoices.forEach(inv => {
    monthRevenue += Number(inv.totalAmount);
    inv.items.forEach(item => {
      monthCost += Number(item.quantity) * Number(item.product.purchasePrice);
    });
  });

  const monthExpenses = await prisma.expense.aggregate({
    where: { createdAt: { gte: startOfMonth } },
    _sum: { amount: true }
  });

  const netProfit = monthRevenue - monthCost - Number(monthExpenses._sum.amount || 0);

  // Treasury (Total Cash)
  const treasuryTotal = await prisma.treasuryTransaction.aggregate({
    _sum: { amount: true }
  });

  const adminStats = {
    inventoryValue,
    totalDebts: Math.abs(Number(debts._sum.currentDebt || 0)),
    totalPatientDeposits: Number(deposits._sum.currentDebt || 0),
    netProfit,
    treasuryBalance: Number(treasuryTotal._sum.amount || 0)
  };


  // 4. Performance Metrics (Instead of sensitive logs)
  const chartData = await reportsService.getSalesChartData(7);
  const topProducts = await reportsService.getTopProducts();

  return {
    lowStockItems,
    shiftStats,
    adminStats,
    topDebtors,
    chartData,
    topProducts
  };
};

module.exports = { getHomeDashboardData };
