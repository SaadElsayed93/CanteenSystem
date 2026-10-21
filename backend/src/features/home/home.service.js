const reportsService = require('../reports/reports.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getHomeDashboardData = async (userId, userRole) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // 1. Low Stock & Expiry Items (For Sales/Purchases/Alerts)
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { batches: true }
  });

  const lowStockItems = [];
  const expiringSoonItems = [];
  const expiredItems = [];
  let inventoryValue = 0;

  products.forEach(p => {
    const totalQty = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    inventoryValue += totalQty * Number(p.purchasePrice);
    if (totalQty <= Number(p.alertThreshold) || totalQty === 0) {
      lowStockItems.push({ id: p.id, name: p.name, quantity: totalQty, alertThreshold: p.alertThreshold });
    }

    // Expiry check
    let effectiveExpiry = p.expiryDate;
    if (!effectiveExpiry && p.batches && p.batches.length > 0) {
      const bWithExp = p.batches
        .filter(b => b.expiryDate && Number(b.quantityRemaining) > 0)
        .sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate))[0];
      if (bWithExp) effectiveExpiry = bWithExp.expiryDate;
    }

    if (effectiveExpiry) {
      const exp = new Date(effectiveExpiry);
      exp.setHours(0, 0, 0, 0);
      const daysLeft = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
      const itemInfo = {
        id: p.id,
        name: p.name,
        quantity: totalQty,
        expiryDate: effectiveExpiry,
        daysLeft,
        daysUntilExpiry: daysLeft
      };
      if (daysLeft < 0) {
        expiredItems.push(itemInfo);
      } else if (daysLeft <= 5) {
        expiringSoonItems.push(itemInfo);
      }
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
      startingCash: Number(startingCash.toFixed(2)),
      sales: Number(sales.toFixed(2)),
      deposits: Number(deposits.toFixed(2)),
      expenses: Number(expenses.toFixed(2)),
      transfers: Number(transfers.toFixed(2)),
      expectedCash: Number(expectedCash.toFixed(2))
    };
  } else {
    // Closed Shift Stats
    const lastShift = await prisma.dailyShift.findFirst({
      where: { status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
      include: { userClosed: { select: { fullName: true } } }
    });

    shiftStats = {
      isOpen: false,
      lastShift,
      expectedCash: Number(expectedCash.toFixed(2))
    };
  }

  // 3. Admin Overview KPIs
  const debts = await prisma.patient.aggregate({
    where: { isActive: true, currentDebt: { lt: 0 } },
    _sum: { currentDebt: true }
  });

  const patientDepositsLiability = await prisma.patient.aggregate({
    where: { isActive: true, currentDebt: { gt: 0 } },
    _sum: { currentDebt: true }
  });

  const topDebtors = await prisma.patient.findMany({
    where: { isActive: true, currentDebt: { lt: 0 } },
    orderBy: { currentDebt: 'asc' }, // الأكثر مديونية أولاً (أكبر قيمة سالبة)
    take: 5
  });

  // Calculate Monthly Canteen Trading Profit (Revenue - Cost of Goods Sold)
  const monthInvoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: startOfMonth }, status: 'COMPLETED' },
    include: { items: { include: { product: true } } }
  });

  let monthRevenue = 0;
  let monthCost = 0;

  monthInvoices.forEach(inv => {
    monthRevenue += Number(inv.totalAmount);
    inv.items.forEach(it => {
      monthCost += Number(it.quantity) * Number(it.product?.purchasePrice || 0);
    });
  });

  // Monthly Net Profit: Canteen Trading Profit (Revenue - Cost of Goods Sold)
  const netProfit = Number((monthRevenue - monthCost).toFixed(2));

  // Total Treasury Balance across all active channels
  const activeMethods = await prisma.paymentMethod.findMany({ where: { isActive: true } });
  const treasuryBalance = activeMethods.reduce((sum, m) => sum + Number(m.currentBalance), 0);

  const adminStats = {
    inventoryValue: Number(inventoryValue.toFixed(2)),
    totalDebts: Number(Math.abs(Number(debts._sum.currentDebt || 0)).toFixed(2)),
    totalPatientDeposits: Number(Number(patientDepositsLiability._sum.currentDebt || 0).toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    treasuryBalance: Number(treasuryBalance.toFixed(2)),
    expiringSoonCount: expiringSoonItems.length,
    expiredCount: expiredItems.length,
    totalExpiryAlerts: expiringSoonItems.length + expiredItems.length
  };

  // 4. Performance Metrics (Instead of sensitive logs)
  const chartData = await reportsService.getSalesChartData(7);
  const topProducts = await reportsService.getTopProducts();

  return {
    lowStockItems,
    expiringSoonItems,
    expiredItems,
    expiringSoonCount: expiringSoonItems.length,
    expiredCount: expiredItems.length,
    shiftStats,
    adminStats,
    topDebtors,
    chartData,
    topProducts
  };
};

module.exports = { getHomeDashboardData };
