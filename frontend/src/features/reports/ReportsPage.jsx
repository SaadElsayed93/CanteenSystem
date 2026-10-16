import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import arEG from 'date-fns/locale/ar-EG';
registerLocale('ar-EG', arEG);
import { 
  TrendingUp, TrendingDown, DollarSign, PackageOpen, Users, 
  ShoppingCart, Calendar, AlertTriangle, Download, Printer, Filter
} from 'lucide-react';


const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} - ${hours}:${minutes} ${ampm}`;
};

const StatCard = ({ title, value, icon: Icon, color, subValue, subLabel, onClick, clickableText }) => (
  <div 
    onClick={onClick}
    className={`bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-sm relative overflow-hidden group hover:border-indigo-100 transition-all ${
      onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02]' : ''
    }`}
  >
    <div className={`absolute top-0 right-0 w-24 h-24 bg-${color}-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform`}></div>
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-gray-500 font-bold mb-1">{title}</p>
        <h3 className={`text-3xl font-black text-${color}-600`}>{value}</h3>
      </div>
      <div className={`p-3 bg-${color}-100 text-${color}-600 rounded-xl`}>
        <Icon size={24} />
      </div>
    </div>
    {subValue && (
      <div className="flex items-center justify-between text-sm mt-4 pt-4 border-t border-gray-50">
        <div className="flex items-center gap-2">
          <span className={`font-bold ${subValue > 0 ? 'text-green-500' : 'text-gray-500'}`}>
            {subValue}
          </span>
          <span className="text-gray-400 font-bold">{subLabel}</span>
        </div>
        {clickableText && (
          <span className={`text-xs font-bold text-${color}-600 hover:underline`}>
            {clickableText} »
          </span>
        )}
      </div>
    )}
  </div>
);

const ReportsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [reportType, setReportType] = useState('SALES');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [endDate, setEndDate] = useState(() => new Date());
  const [detailedData, setDetailedData] = useState(null);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      const res = await client.get(`/reports/detailed?type=${reportType}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`);
      setDetailedData(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء استخراج التقرير');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await client.get('/reports/dashboard');
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) return (
    <div className="flex justify-center items-center h-96">
      <div className="text-2xl font-bold text-gray-400 animate-pulse">جاري تحضير الإحصائيات...</div>
    </div>
  );

  const { metrics, chartData, topProducts } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-800">التقارير والإحصائيات 📊</h2>
          <p className="text-gray-500 mt-1 font-bold">نظرة عامة على أداء الكانتين والمؤشرات المالية</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'DASHBOARD' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            لوحة القيادة
          </button>
          <button 
            onClick={() => setActiveTab('DETAILED')}
            className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'DETAILED' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            تقارير مفصلة
          </button>
        </div>
      </div>

      {activeTab === 'DASHBOARD' && (
        <>
          {/* Top Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <StatCard 
              title="مبيعات اليوم" 
              value={`${metrics.todaySales} ج.م`} 
              icon={ShoppingCart} 
              color="indigo" 
              subValue={`${metrics.monthSales} ج.م`}
              subLabel="إجمالي الشهر"
            />
            <StatCard 
              title="أرباح اليوم التقريبية" 
              value={`${metrics.todayProfit} ج.م`} 
              icon={TrendingUp} 
              color="emerald" 
              subValue="صافي ربح"
              subLabel="بعد خصم التكلفة"
            />
            <StatCard 
              title="ديون المرضى (لنا)" 
              value={`${metrics.totalPatientDebt} ج.م`} 
              icon={Users} 
              color="red" 
              subValue="مستحقة للكانتين"
              subLabel="أرصدة سالبة"
            />
            <StatCard 
              title="أموال المرضى (أمانات لهم)" 
              value={`${(metrics.totalPatientDeposits || 0).toFixed(2)} ج.م`} 
              icon={DollarSign} 
              color="amber" 
              subValue="واجبة الرد"
              subLabel="تُصرف عند الخروج"
            />
            <StatCard 
              title="نواقص المخزون" 
              value={metrics.lowStockCount} 
              icon={AlertTriangle} 
              color="amber" 
              subValue={`${metrics.inventoryValue} ج.م`}
              subLabel="قيمة المخزون الحالي"
              onClick={() => setShowLowStockModal(true)}
              clickableText="استعراض النواقص"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Chart */}
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-gray-800">مبيعات آخر 7 أيام</h3>
                <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold">
                  آخر أسبوع
                </div>
              </div>
              <div className="h-80 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontWeight: 'bold' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 'bold', color: '#374151', marginBottom: '4px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="المبيعات" 
                      stroke="#4f46e5" 
                      strokeWidth={4}
                      dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, fill: '#4f46e5', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Products */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-100">
              <h3 className="text-lg font-black text-gray-800 mb-6">الأصناف الأكثر مبيعاً (هذا الشهر)</h3>
              <div className="space-y-4">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-indigo-50 text-indigo-600'}`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400 font-bold">{p.quantity} قطعة مباعة</p>
                      </div>
                    </div>
                    <div className="font-black text-indigo-600">
                      {p.revenue} ج
                    </div>
                  </div>
                ))}
                {topProducts.length === 0 && (
                  <div className="text-center text-gray-400 font-bold py-8">لا توجد مبيعات هذا الشهر حتى الآن</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

            {activeTab === 'DETAILED' && (
        <div className="space-y-6 print:m-0 print:p-0">
          {/* Filters - Hidden when printing */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-100 flex flex-col md:flex-row gap-4 items-end print:hidden">
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-700 mb-2">نوع التقرير</label>
              <select 
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-indigo-500 focus:ring-0"
              >
                <option value="SALES">تقرير المبيعات والأرباح</option>
                <option value="PURCHASES">تقرير المشتريات والموردين</option>
                <option value="EXPENSES">تقرير المصروفات</option>
                <option value="INVENTORY">تقرير تقييم المخزون الحالي</option>
                <option value="LOW_STOCK">تقرير نواقص المخزون والاحتياجات</option>
                <option value="PATIENTS">تقرير أرصدة وحسابات المرضى (النشطين فقط)</option>
              </select>
            </div>
            
            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-700 mb-2">من تاريخ</label>
              <DatePicker 
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="dd/MM/yyyy"
                locale="ar-EG"
                className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-indigo-500 focus:ring-0"
                disabled={reportType === 'INVENTORY' || reportType === 'LOW_STOCK' || reportType === 'PATIENTS'}
              />
            </div>

            <div className="flex-1 w-full">
              <label className="block text-sm font-bold text-gray-700 mb-2">إلى تاريخ</label>
              <DatePicker 
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                dateFormat="dd/MM/yyyy"
                locale="ar-EG"
                className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-indigo-500 focus:ring-0"
                disabled={reportType === 'INVENTORY' || reportType === 'LOW_STOCK' || reportType === 'PATIENTS'}
              />
            </div>

            <button 
              onClick={generateReport}
              disabled={isGenerating}
              className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Filter size={20} />
              {isGenerating ? 'جاري الاستخراج...' : 'عرض التقرير'}
            </button>
          </div>

          {/* Report Display */}
          {detailedData && (
            <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-gray-100 print:border-none print:shadow-none print:p-0">
              
              {/* Report Header for Print */}
              <div className="text-center mb-8 border-b-2 border-gray-200 pb-6 print:block">
                <h1 className="text-3xl font-black text-gray-900 mb-2">
                  {reportType === 'SALES' && 'تقرير المبيعات الشامل'}
                  {reportType === 'PURCHASES' && 'تقرير المشتريات الشامل'}
                  {reportType === 'EXPENSES' && 'تقرير المصروفات الشامل'}
                  {reportType === 'INVENTORY' && 'تقرير تقييم المخزون الشامل'}
                  {reportType === 'LOW_STOCK' && 'تقرير نواقص المخزون والاحتياجات (أصناف تحتاج شراء)'}
                  {reportType === 'PATIENTS' && 'تقرير أرصدة وحسابات المرضى الحاليين (النشطين فقط)'}
                </h1>
                {reportType !== 'INVENTORY' && reportType !== 'LOW_STOCK' && reportType !== 'PATIENTS' && (
                  <p className="text-lg font-bold text-gray-500">
                    عن الفترة من {formatDate(startDate)} إلى {formatDate(endDate)}
                  </p>
                )}
                {(reportType === 'INVENTORY' || reportType === 'LOW_STOCK' || reportType === 'PATIENTS') && (
                  <p className="text-lg font-bold text-gray-500">
                    تاريخ ووقت الاستخراج: {formatDateTime(new Date())}
                  </p>
                )}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {Object.entries(detailedData.summary).map(([key, val]) => (
                  <div key={key} className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
                    <p className="text-gray-500 font-bold mb-1 text-sm">
                      {key === 'totalSales' && 'إجمالي المبيعات'}
                      {key === 'totalCost' && 'تكلفة المبيعات'}
                      {key === 'totalProfit' && 'صافي الربح التقريبي'}
                      {key === 'cashSales' && 'المبيعات النقدية'}
                      {key === 'creditSales' && 'مبيعات على حساب المرضى'}
                      {key === 'invoiceCount' && 'عدد الفواتير'}
                      {key === 'productCount' && 'عدد الأصناف المباعة'}
                      {key === 'totalPurchases' && 'إجمالي قيمة المشتريات'}
                      {key === 'totalPaid' && 'المدفوع للموردين'}
                      {key === 'totalRemaining' && 'المتبقي للموردين'}
                      {key === 'purchaseCount' && 'عدد فواتير الشراء'}
                      {key === 'totalExpenses' && 'إجمالي المصروفات'}
                      {key === 'expenseCount' && 'عدد المصروفات'}
                      {key === 'totalValue' && 'القيمة الإجمالية للمخزون'}
                      {key === 'lowStockCount' && 'عدد الأصناف الناقصة'}
                      {key === 'totalNeededCost' && 'التكلفة التقديرية لإعادة الطلب'}
                      {key === 'totalItems' && 'إجمالي كمية القطع'}
                      {key === 'uniqueProducts' && 'عدد الأصناف المسجلة'}
                      {key === 'totalDebts' && 'إجمالي ديون المرضى (لنا)'}
                      {key === 'totalDeposits' && 'إجمالي أموال المرضى (أمانات لهم)'}
                      {key === 'netDifference' && 'صافي الفارق المالي'}
                      {key === 'totalPatients' && 'إجمالي عدد المرضى النشطين'}
                      {key === 'activePatients' && 'عدد المرضى النشطين'}
                    </p>
                    <p className="text-2xl font-black text-indigo-700">
                      {typeof val === 'number' && key !== 'invoiceCount' && key !== 'purchaseCount' && key !== 'productCount' && key !== 'expenseCount' && key !== 'totalItems' && key !== 'uniqueProducts' && key !== 'lowStockCount' && key !== 'totalPatients' && key !== 'activePatients'
                        ? `${val.toFixed(2)} ج.م` 
                        : val}
                    </p>
                  </div>
                ))}
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-indigo-50 border-y-2 border-indigo-100">
                      {reportType === 'SALES' && (
                        <>
                          <th className="p-3 font-bold text-indigo-800">الصنف</th>
                          <th className="p-3 font-bold text-indigo-800">الكمية المباعة</th>
                          <th className="p-3 font-bold text-indigo-800">تكلفة الشراء (الإجمالية)</th>
                          <th className="p-3 font-bold text-indigo-800">سعر البيع (الإجمالي)</th>
                          <th className="p-3 font-bold text-indigo-800">صافي الربح</th>
                        </>
                      )}
                      {reportType === 'PURCHASES' && (
                        <>
                          <th className="p-3 font-bold text-indigo-800">رقم الفاتورة</th>
                          <th className="p-3 font-bold text-indigo-800">التاريخ</th>
                          <th className="p-3 font-bold text-indigo-800">المورد</th>
                          <th className="p-3 font-bold text-indigo-800 w-1/3">الأصناف</th>
                          <th className="p-3 font-bold text-indigo-800">الإجمالي</th>
                          <th className="p-3 font-bold text-indigo-800">المدفوع</th>
                        </>
                      )}
                      {reportType === 'EXPENSES' && (
                        <>
                          <th className="p-3 font-bold text-indigo-800">التاريخ</th>
                          <th className="p-3 font-bold text-indigo-800">التصنيف</th>
                          <th className="p-3 font-bold text-indigo-800 w-1/2">البيان</th>
                          <th className="p-3 font-bold text-indigo-800">وسيلة الدفع</th>
                          <th className="p-3 font-bold text-indigo-800">المبلغ</th>
                        </>
                      )}
                      {(reportType === 'INVENTORY' || reportType === 'LOW_STOCK') && (
                        <>
                          <th className="p-3 font-bold text-indigo-800">الصنف</th>
                          <th className="p-3 font-bold text-indigo-800">الوحدة</th>
                          <th className="p-3 font-bold text-indigo-800">الكمية الحالية</th>
                          <th className="p-3 font-bold text-indigo-800">سعر الشراء (التكلفة)</th>
                          <th className="p-3 font-bold text-indigo-800">القيمة الإجمالية</th>
                        </>
                      )}
                      {reportType === 'PATIENTS' && (
                        <>
                          <th className="p-3 font-bold text-indigo-800">رقم الملف</th>
                          <th className="p-3 font-bold text-indigo-800">اسم المريض</th>
                          <th className="p-3 font-bold text-indigo-800">الرقم الداخلي</th>
                          <th className="p-3 font-bold text-indigo-800">نوع الحساب</th>
                          <th className="p-3 font-bold text-indigo-800">الرصيد المالي</th>
                          <th className="p-3 font-bold text-indigo-800">الحالة</th>
                          <th className="p-3 font-bold text-indigo-800">ملاحظات</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailedData.data.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        {reportType === 'SALES' && (
                          <>
                            <td className="p-3 font-bold text-gray-800">{row.name}</td>
                            <td className="p-3 font-bold text-indigo-600">{row.quantity}</td>
                            <td className="p-3 font-bold text-red-600">{row.cost} ج</td>
                            <td className="p-3 font-black text-emerald-600">{row.revenue} ج</td>
                            <td className="p-3 font-black text-indigo-700">{row.profit} ج</td>
                          </>
                        )}
                        {reportType === 'PURCHASES' && (
                          <>
                            <td className="p-3 font-bold text-gray-700">{row.id}</td>
                            <td className="p-3 text-gray-600">{formatDateTime(row.date)}</td>
                            <td className="p-3 font-bold text-gray-800">{row.supplierName}</td>
                            <td className="p-3 text-sm text-gray-500">{row.itemsSummary}</td>
                            <td className="p-3 font-black text-indigo-600">{row.total} ج</td>
                            <td className="p-3 font-bold text-gray-600">{row.paid} ج</td>
                          </>
                        )}
                        {reportType === 'EXPENSES' && (
                          <>
                            <td className="p-3 text-gray-600">{formatDate(row.date)}</td>
                            <td className="p-3 font-bold text-gray-800">{row.category}</td>
                            <td className="p-3 text-gray-600">{row.description}</td>
                            <td className="p-3 font-bold text-gray-600">{row.paymentMethod}</td>
                            <td className="p-3 font-black text-red-600">{row.amount} ج</td>
                          </>
                        )}
                        {(reportType === 'INVENTORY' || reportType === 'LOW_STOCK') && (
                          <>
                            <td className="p-3 font-bold text-gray-800">{row.name}</td>
                            <td className="p-3 text-gray-600">{row.category}</td>
                            <td className="p-3 font-bold text-gray-800">{row.quantity}</td>
                            <td className="p-3 text-gray-600">{row.purchasePrice} ج</td>
                            <td className="p-3 font-black text-indigo-600">{row.totalValue} ج</td>
                          </>
                        )}
                        {reportType === 'PATIENTS' && (
                          <>
                            <td className="p-3 font-mono font-bold text-gray-700">{row.id}</td>
                            <td className="p-3 font-black text-gray-900">{row.name}</td>
                            <td className="p-3 font-bold text-gray-500">{row.internalNumber}</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                row.currentDebt < 0 
                                  ? 'bg-red-50 text-red-700 border border-red-200' 
                                  : row.currentDebt > 0 
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                  : 'bg-gray-50 text-gray-600 border border-gray-200'
                              }`}>
                                {row.type}
                              </span>
                            </td>
                            <td className={`p-3 font-black text-sm ${
                              row.currentDebt < 0 ? 'text-red-600' : row.currentDebt > 0 ? 'text-emerald-600' : 'text-gray-500'
                            }`}>
                              {Math.abs(row.currentDebt).toFixed(2)} ج.م {row.currentDebt < 0 ? '(مدين للكانتين)' : row.currentDebt > 0 ? '(أمانات مستحقة)' : ''}
                            </td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                row.status === 'نشط' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="p-3 text-xs text-gray-500">{row.notes}</td>
                          </>
                        )}
                      </tr>
                    ))}
                    {detailedData.data.length === 0 && (
                      <tr>
                        <td colSpan="10" className="p-8 text-center text-gray-400 font-bold text-lg">
                          لا توجد بيانات مطابقة للبحث في هذه الفترة
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Print Footer / Controls */}
              <div className="mt-8 flex justify-center print:hidden">
                <button 
                  onClick={handlePrint}
                  className="bg-gray-800 text-white font-bold px-8 py-3 rounded-xl hover:bg-black flex items-center gap-2 transition-all shadow-lg hover:shadow-xl"
                >
                  <Printer size={20} />
                  طباعة التقرير (أو حفظ كـ PDF)
                </button>
              </div>

            </div>
          )}
        </div>
      )}


      {/* Low Stock Quick Modal */}
      {showLowStockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-lg flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={24} />
                <h3 className="text-xl font-black text-gray-800">قائمة نواقص المخزون</h3>
              </div>
              <button 
                onClick={() => setShowLowStockModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mb-4">
              {!metrics.lowStockItems || metrics.lowStockItems.length === 0 ? (
                <div className="text-center py-12 text-gray-400 font-bold">
                  🎉 ممتاز! لا توجد نواقص في المخزون حالياً.
                </div>
              ) : (
                <div className="space-y-3">
                  {metrics.lowStockItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3.5 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100/60 transition-colors">
                      <div>
                        <div className="font-bold text-gray-800">{item.name}</div>
                        <div className="text-xs text-gray-400 font-bold mt-0.5">حد التنبيه الأدنى: {item.alertThreshold} {item.unit || 'قطعة'}</div>
                      </div>
                      <div className="text-left">
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-xl font-black text-sm inline-block">
                          المتبقي: {item.quantity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button 
                onClick={() => setShowLowStockModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-6 py-2.5 rounded-xl transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
