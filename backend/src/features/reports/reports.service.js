const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDashboardMetrics = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Today's Sales
  const todaySales = await prisma.invoice.aggregate({
    where: { createdAt: { gte: today }, status: 'COMPLETED' },
    _sum: { totalAmount: true }
  });

  // Month's Sales
  const monthSales = await prisma.invoice.aggregate({
    where: { createdAt: { gte: startOfMonth }, status: 'COMPLETED' },
    _sum: { totalAmount: true }
  });

  // Today's Profits (Sales - Cost)
  // We need to calculate cost of goods sold (COGS) for today
  const todayInvoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: today }, status: 'COMPLETED' },
    include: { items: { include: { product: true } } }
  });

  let todayCost = 0;
  todayInvoices.forEach(inv => {
    inv.items.forEach(item => {
      // Assuming product.purchasePrice is the cost at the time of sale. 
      // For absolute accuracy, we should track cost per invoice item, but this is a good approximation.
      todayCost += Number(item.quantity) * Number(item.product.purchasePrice);
    });
  });
  const todayRevenue = Number(todaySales._sum.totalAmount || 0);
  const todayProfit = todayRevenue - todayCost;

  // Patient Debts (Total)
  const patientDebts = await prisma.patient.aggregate({
    where: { currentDebt: { lt: 0 } }, // debt is negative
    _sum: { currentDebt: true }
  });

  // Patient Deposits (Total)
  const patientDeposits = await prisma.patient.aggregate({
    where: { currentDebt: { gt: 0 } }, 
    _sum: { currentDebt: true }
  });

  // Low stock products count
  const lowStockProducts = await prisma.product.count({
    where: { 
      batches: {
        some: { quantityRemaining: { gt: 0 } }
      },
      // Note: A true low stock needs aggregation of batches. 
      // We can just fetch all products with their batches and filter in memory for accuracy
    }
  });

  const products = await prisma.product.findMany({
    include: { batches: true }
  });
  
  let lowStockCount = 0;
  let inventoryValue = 0;

  products.forEach(p => {
    const totalQty = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
    if (totalQty <= Number(p.minStockLevel)) lowStockCount++;
    inventoryValue += totalQty * Number(p.purchasePrice);
  });

  return {
    todaySales: todayRevenue,
    todayProfit,
    monthSales: Number(monthSales._sum.totalAmount || 0),
    totalPatientDebt: Math.abs(Number(patientDebts._sum.currentDebt || 0)),
    totalPatientDeposits: Number(patientDeposits._sum.currentDebt || 0),
    lowStockCount,
    inventoryValue
  };
};

const getSalesChartData = async (days = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);

  const invoices = await prisma.invoice.findMany({
    where: { createdAt: { gte: startDate }, status: 'COMPLETED' },
    select: { createdAt: true, totalAmount: true }
  });

  // Group by day
  const dailyData = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    dailyData[dateStr] = 0;
  }

  invoices.forEach(inv => {
    const dateStr = inv.createdAt.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    if (dailyData[dateStr] !== undefined) {
      dailyData[dateStr] += Number(inv.totalAmount);
    }
  });

  return Object.entries(dailyData).map(([date, amount]) => ({
    date,
    المبيعات: amount
  }));
};

const getTopProducts = async () => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const items = await prisma.invoiceItem.findMany({
    where: { invoice: { createdAt: { gte: startOfMonth }, status: 'COMPLETED' } },
    include: { product: true }
  });

  const productSales = {};
  items.forEach(item => {
    if (!productSales[item.productId]) {
      productSales[item.productId] = {
        name: item.product.name,
        quantity: 0,
        revenue: 0
      };
    }
    productSales[item.productId].quantity += Number(item.quantity);
    productSales[item.productId].revenue += Number(item.subtotal);
  });

  return Object.values(productSales)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5); // Top 5
};


const getDetailedReport = async (type, startDateStr, endDateStr) => {
  // Parse dates and set boundaries (start of day to end of day)
  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = endDateStr ? new Date(endDateStr) : new Date();
  endDate.setHours(23, 59, 59, 999);

  if (type === 'SALES') {
    const invoices = await prisma.invoice.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: {
        items: { include: { product: true } },
        patient: { select: { fullName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    let totalSales = 0;
    let totalCost = 0;
    let cashSales = 0;
    let creditSales = 0;

    const data = invoices.map(inv => {
      let invoiceCost = 0;
      inv.items.forEach(item => {
        invoiceCost += Number(item.quantity) * Number(item.product.purchasePrice);
      });

      if (inv.status === 'COMPLETED') {
        totalSales += Number(inv.totalAmount);
        totalCost += invoiceCost;
        if (inv.paymentType === 'CASH') cashSales += Number(inv.totalAmount);
        else creditSales += Number(inv.totalAmount);
      }

      return {
        id: inv.invoiceNumber,
        date: inv.createdAt,
        type: inv.paymentType === 'CASH' ? 'نقدي' : 'آجل',
        patientName: inv.patient?.fullName || 'غير محدد',
        total: Number(inv.totalAmount),
        status: inv.status === 'COMPLETED' ? 'مكتملة' : 'مرتجع',
        profit: Number(inv.totalAmount) - invoiceCost,
        itemsSummary: inv.items.map(i => `${i.quantity}x ${i.product.name}`).join('، ')
      };
    });

    return {
      summary: {
        totalSales,
        totalCost,
        totalProfit: totalSales - totalCost,
        cashSales,
        creditSales,
        invoiceCount: invoices.length
      },
      data
    };
  }

  if (type === 'PURCHASES') {
    const purchases = await prisma.supplierPurchase.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
      include: {
        supplier: true,
        items: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    let totalPurchases = 0;
    let totalPaid = 0;

    const data = purchases.map(pur => {
      totalPurchases += Number(pur.totalAmount);
      totalPaid += Number(pur.paidAmount);
      
      return {
        id: pur.referenceNo,
        date: pur.createdAt,
        supplierName: pur.supplier?.name || 'غير محدد',
        total: Number(pur.totalAmount),
        paid: Number(pur.paidAmount),
        remaining: Number(pur.totalAmount) - Number(pur.paidAmount),
        status: pur.status === 'PAID' ? 'خالصة' : pur.status === 'PARTIAL' ? 'مدفوعة جزئياً' : 'غير مدفوعة',
        itemsSummary: pur.items.map(i => `${i.quantity}x ${i.product.name}`).join('، ')
      };
    });

    return {
      summary: {
        totalPurchases,
        totalPaid,
        totalRemaining: totalPurchases - totalPaid,
        purchaseCount: purchases.length
      },
      data
    };
  }

  if (type === 'EXPENSES') {
    const expenses = await prisma.expense.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { category: true, paymentMethod: true },
      orderBy: { date: 'desc' }
    });

    let totalExpenses = 0;

    const data = expenses.map(exp => {
      totalExpenses += Number(exp.amount);
      return {
        id: exp.id,
        date: exp.date,
        category: exp.category.name,
        amount: Number(exp.amount),
        description: exp.description || 'بدون وصف',
        paymentMethod: exp.paymentMethod.name
      };
    });

    return {
      summary: { totalExpenses, expenseCount: expenses.length },
      data
    };
  }
  
  if (type === 'INVENTORY') {
    // Inventory is a snapshot, no date filtering applies usually, but we return current state
    const products = await prisma.product.findMany({
      include: { batches: true, category: true },
      orderBy: { name: 'asc' }
    });

    let totalValue = 0;
    let totalItems = 0;

    const data = products.map(p => {
      const qty = p.batches.reduce((sum, b) => sum + Number(b.quantityRemaining), 0);
      const value = qty * Number(p.purchasePrice);
      totalValue += value;
      totalItems += qty;

      return {
        id: p.id,
        name: p.name,
        category: p.category.name,
        quantity: qty,
        purchasePrice: Number(p.purchasePrice),
        sellingPrice: Number(p.sellingPrice),
        totalValue: value
      };
    });

    return {
      summary: { totalValue, totalItems, uniqueProducts: products.length },
      data
    };
  }

  throw new Error('نوع التقرير غير مدعوم');
};

module.exports = { getDashboardMetrics, getSalesChartData, getTopProducts, getDetailedReport };
