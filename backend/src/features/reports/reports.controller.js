const reportsService = require('./reports.service');

const getDashboard = async (req, res, next) => {
  try {
    const [metrics, chartData, topProducts] = await Promise.all([
      reportsService.getDashboardMetrics(),
      reportsService.getSalesChartData(7), // last 7 days
      reportsService.getTopProducts()
    ]);
    
    res.json({
      success: true,
      data: { metrics, chartData, topProducts }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboard };
