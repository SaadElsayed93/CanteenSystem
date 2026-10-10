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

module.exports = { getDashboardMetrics, getSalesChartData, getTopProducts };
