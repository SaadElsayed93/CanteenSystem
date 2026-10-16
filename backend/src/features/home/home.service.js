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

  // 2. Shift Stats (Live Daily Shift Engine)
  const drawerMethod = await prisma.paymentMethod.findFirst({
    where: { name: { contains: 'درج' } }
  });
  const drawerId = drawerMethod ? drawerMethod.id : 1;
  const expectedCash = drawerMethod ? Number(drawerMethod.currentBalance) : 0;

  const activeShift = await prisma.dailyShift.findFirst({
    where: { status: 'OPEN' },
    include: { userOpened: { select: { fullName: true } } }
  });

  let shiftStats;

  if (activeShift) {
    const shiftSince = activeShift.openedAt;

    // Cash Sales during this shift
    const shiftCashSales = await prisma.invoice.aggregate({
      where: { createdAt: { gte: shiftSince }, status: 'COMPLETED' },
      _sum: { cashAmount: true }
    });
    const sales = Number(shiftCashSales._sum.cashAmount || 0);
    
    // Cash Patient Deposits & Collections entering the drawer during this shift
    const shiftDrawerDeposits = await prisma.treasuryTransaction.aggregate({
      where: { 
        createdAt: { gte: shiftSince }, 
        paymentMethodId: drawerId, 
        type: 'IN', 
        referenceType: 'PATIENT_TX' 
      },
      _sum: { amount: true }
    });
    const deposits = Number(shiftDrawerDeposits._sum.amount || 0);

    // Cash Outflows from Drawer (Operating Expenses + Supplier Payments + Patient Refunds)
    const shiftDrawerExpenses = await prisma.expense.aggregate({
      where: { 
        createdAt: { gte: shiftSince }, 
        paymentMethodId: drawerId 
      },
      _sum: { amount: true }
    });
    const expenses = Number(shiftDrawerExpenses._sum.amount || 0);

    // Cash Transfers & Settlements out of the Drawer during this shift
    const shiftDrawerTransfers = await prisma.treasuryTransaction.aggregate({
      where: { 
        createdAt: { gte: shiftSince }, 
        paymentMethodId: drawerId, 
        type: 'OUT', 
        referenceType: { in: ['TRANSFER', 'DAILY_SETTLEMENT'] } 
      },
      _sum: { amount: true }
    });
    const transfers = Number(shiftDrawerTransfers._sum.amount || 0);
    const startingCash = Number(activeShift.startingCash);

    shiftStats = {
      isOpen: true,
      shiftId: activeShift.id,
      shiftNumber: activeShift.shiftNumber,
      openedAt: activeShift.openedAt,
      openedBy: activeShift.userOpened.fullName,
      startingCash,
      sales,
      deposits,
      expenses,
      transfers,
      expectedCash
    };
  } else {
    const lastShift = await prisma.dailyShift.findFirst({
      where: { status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      include: {
        userOpened: { select: { fullName: true } },
        userClosed: { select: { fullName: true } }
      }
    });

    shiftStats = {
      isOpen: false,
      shiftId: null,
      shiftNumber: null,
      lastShift,
      startingCash: expectedCash,
      sales: 0,
      deposits: 0,
      expenses: 0,
      transfers: 0,
      expectedCash
    };
  }

  // 3. Admin Stats
  // Patient Debts (Negative balance: what patients owe to the canteen)
  const debts = await prisma.patient.aggregate({
    where: { currentDebt: { lt: 0 } },
    _sum: { currentDebt: true }
  });

  // Patient Deposits (Positive balance: liabilities/deposits owed to patients upon discharge)
  const patientDepositsLiability = await prisma.patient.aggregate({
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

  // Operational expenses only (exclude supplier payments already in COGS and patient deposit returns)
  const monthOperatingExpenses = await prisma.expense.aggregate({
    where: { 
      createdAt: { gte: startOfMonth },
      category: { name: { notIn: ['سداد لمورد', 'رد أمانات وتصفية مرضى', 'مسحوبات مرضى'] } }
    },
    _sum: { amount: true }
  });

  const netProfit = monthRevenue - monthCost - Number(monthOperatingExpenses._sum.amount || 0);

  // Total Treasury Balance across all active channels
  const activeMethods = await prisma.paymentMethod.findMany({ where: { isActive: true } });
  const treasuryBalance = activeMethods.reduce((sum, m) => sum + Number(m.currentBalance), 0);

  const adminStats = {
    inventoryValue,
    totalDebts: Math.abs(Number(debts._sum.currentDebt || 0)),
    totalPatientDeposits: Number(patientDepositsLiability._sum.currentDebt || 0),
    netProfit,
    treasuryBalance
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
