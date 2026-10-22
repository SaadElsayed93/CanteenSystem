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


const getDetailedReport = async (req, res, next) => {
  try {
    const { type, startDate, endDate } = req.query;
    if (!type) throw new Error('يرجى تحديد نوع التقرير');
    
    const reportData = await reportsService.getDetailedReport(type, startDate, endDate, req.query);
    
    res.json({ success: true, data: reportData });
  } catch (error) {
    next(error);
  }
};

const getKitchenClosingStatus = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const sDate = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const eDate = endDate ? new Date(endDate) : new Date();
    eDate.setHours(23, 59, 59, 999);

    const data = await reportsService.getKitchenClosingStatus(sDate, eDate);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

const settleKitchenMonth = async (req, res, next) => {
  try {
    const { startDate, endDate, notes, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'يرجى تقديم بيانات الأصناف المراد تسويتها' });
    }
    const result = await reportsService.settleKitchenMonth({ startDate, endDate, notes, items }, req.user.id);
    res.json({ 
      success: true, 
      data: result, 
      message: 'تم اعتماد تقفيلة المطبخ وتسوية المخزن بنجاح' 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { 
  getDashboard, 
  getDetailedReport,
  getKitchenClosingStatus,
  settleKitchenMonth
};
