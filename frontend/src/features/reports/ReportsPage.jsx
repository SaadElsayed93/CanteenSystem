import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import toast from 'react-hot-toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import arEG from 'date-fns/locale/ar-EG';
registerLocale('ar-EG', arEG);

import { 
  TrendingUp, TrendingDown, DollarSign, PackageOpen, Users, 
  ShoppingCart, Calendar, AlertTriangle, Download, Printer, 
  Filter, Clock, FileText, CheckCircle2, Truck, Wallet, ArrowUpRight,
  ArrowDownRight, Layers, Sparkles
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
  hours = hours ? hours : 12;
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
        <p className="text-gray-500 font-bold mb-1 text-sm">{title}</p>
        <h3 className={`text-3xl font-black text-${color}-600`}>{value}</h3>
      </div>
      <div className={`p-3 bg-${color}-100 text-${color}-600 rounded-xl`}>
        <Icon size={24} />
      </div>
    </div>
    {subValue && (
      <div className="flex items-center justify-between text-xs mt-4 pt-4 border-t border-gray-50">
        <div className="flex items-center gap-2">
          <span className={`font-black ${subValue > 0 ? 'text-green-600' : 'text-gray-600'}`}>
            {subValue}
          </span>
          <span className="text-gray-400 font-bold">{subLabel}</span>
        </div>
        {clickableText && (
          <span className={`font-black text-${color}-600 hover:underline`}>
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
  const [activeTab, setActiveTab] = useState('DETAILED'); // Default to detailed reports as requested
  const [reportType, setReportType] = useState('DAILY_FINANCIAL'); // Default to Daily Financial!
  
  // Quick Presets State
  const [preset, setPreset] = useState('TODAY'); // 'TODAY', 'YESTERDAY', 'WEEK', 'THIS_MONTH', 'LAST_MONTH', 'CUSTOM'
  const [singleDate, setSingleDate] = useState(() => new Date());
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => new Date());
  
  const [detailedData, setDetailedData] = useState(null);
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchDashboard();
    // Auto-generate today's report on load!
    generateReportForDates('DAILY_FINANCIAL', new Date(), new Date());
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

  const applyPreset = (p) => {
    setPreset(p);
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (p === 'TODAY') {
      s = new Date();
      e = new Date();
      setSingleDate(s);
    } else if (p === 'YESTERDAY') {
      s = new Date();
      s.setDate(s.getDate() - 1);
      e = new Date(s);
      setSingleDate(s);
    } else if (p === 'WEEK') {
      s = new Date();
      s.setDate(s.getDate() - 7);
      e = new Date();
    } else if (p === 'THIS_MONTH') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = new Date();
    } else if (p === 'LAST_MONTH') {
      s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      e = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    setStartDate(s);
    setEndDate(e);

    // Auto-generate when switching preset for instant 1-click experience!
    generateReportForDates(reportType, s, e);
  };

  const handleSingleDateChange = (date) => {
    setSingleDate(date);
    setStartDate(date);
    setEndDate(date);
    generateReportForDates(reportType, date, date);
  };

  const generateReportForDates = async (typeToFetch, sDate, eDate) => {
    setIsGenerating(true);
    try {
      const sStr = sDate.toISOString().split('T')[0];
      const eStr = eDate.toISOString().split('T')[0];
      const res = await client.get(`/reports/detailed?type=${typeToFetch}&startDate=${sStr}&endDate=${eStr}`);
      setDetailedData(res.data.data);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء استخراج التقرير');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateReport = () => {
    generateReportForDates(reportType, startDate, endDate);
  };

  const handleReportTypeChange = (newType) => {
    setReportType(newType);
    if (newType === 'DAILY_FINANCIAL') {
      // Auto set to single day (today)
      setPreset('TODAY');
      const today = new Date();
      setSingleDate(today);
      setStartDate(today);
      setEndDate(today);
      generateReportForDates(newType, today, today);
    } else if (newType === 'MONTHLY_FINANCIAL') {
      // Auto set to this month
      setPreset('THIS_MONTH');
      const now = new Date();
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date();
      setStartDate(s);
      setEndDate(e);
      generateReportForDates(newType, s, e);
    } else {
      generateReportForDates(newType, startDate, endDate);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading || !data) return (
    <div className="flex justify-center items-center h-96">
      <div className="text-2xl font-bold text-gray-400 animate-pulse">جاري تحضير الإحصائيات والتقارير...</div>
    </div>
  );

  const { metrics, chartData, topProducts } = data;
  const isSingleDayMode = reportType === 'DAILY_FINANCIAL' || preset === 'TODAY' || preset === 'YESTERDAY';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center print:hidden">
        <div>
          <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 inline-block mb-1.5 shadow-sm">
            المستشفى العسكري ق.م بالإسماعيلية
          </span>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <FileText className="text-indigo-600" size={26} />
            <span>التقارير والإحصائيات المالية</span>
          </h2>
          <p className="text-gray-500 mt-1 font-bold text-sm">استخراج التقارير اليومية والشهرية بنقرة زر واحدة وتصديرها</p>
        </div>
        <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
          <button 
            onClick={() => setActiveTab('DETAILED')}
            className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${
              activeTab === 'DETAILED' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            التقارير المفصلة واليومية
          </button>
          <button 
            onClick={() => setActiveTab('DASHBOARD')}
            className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${
              activeTab === 'DASHBOARD' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            لوحة المؤشرات والرسوم
          </button>
        </div>
      </div>

      {/* ================= DASHBOARD TAB ================= */}
      {activeTab === 'DASHBOARD' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            <StatCard 
              title="مبيعات اليوم" 
              value={`${(metrics.todaySales || 0).toFixed(2)} ج.م`} 
              icon={ShoppingCart} 
              color="indigo" 
              subValue={`${(metrics.monthSales || 0).toFixed(2)} ج.م`}
              subLabel="إجمالي الشهر"
            />
            <StatCard 
              title="أرباح اليوم التقريبية" 
              value={`${(metrics.todayProfit || 0).toFixed(2)} ج.م`} 
              icon={TrendingUp} 
              color="emerald" 
              subValue={`${(metrics.todayExpenses || 0).toFixed(2)} ج.م`}
              subLabel="مصروفات اليوم"
            />
            <StatCard 
              title="ديون المرضى (لنا)" 
              value={`${(metrics.totalPatientDebt || 0).toFixed(2)} ج.م`} 
              icon={Users} 
              color="red" 
              subValue="مستحقة للكانتين"
              subLabel="أرصدة سالبة نشطة"
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
              subValue={`${(metrics.inventoryValue || 0).toFixed(2)} ج.م`}
              subLabel="قيمة المخزون الحالي"
              onClick={() => setShowLowStockModal(true)}
              clickableText="استعراض النواقص"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-100">
              <h3 className="text-lg font-black text-gray-800 mb-6">الأصناف الأكثر مبيعاً (هذا الشهر)</h3>
              <div className="space-y-4">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-gray-100 text-gray-600' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800">{p.name}</p>
                        <p className="text-xs text-gray-400 font-bold">{p.quantity} قطعة مباعة</p>
                      </div>
                    </div>
                    <div className="font-black text-indigo-600">
                      {p.revenue} ج.م
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

      {/* ================= DETAILED REPORTS TAB ================= */}
      {activeTab === 'DETAILED' && (
        <div className="space-y-6 print:m-0 print:p-0">
          
          {/* Controls & Quick Presets (Hidden in Print) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-gray-200 print:hidden space-y-5">
            
            {/* Quick 1-Click Presets Bar */}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">الفترة الزمنية السريعة (اختر بنقرة واحدة):</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('TODAY')}
                  className={`px-4 py-2 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 ${
                    preset === 'TODAY' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  <Sparkles size={14} />
                  <span>اليوم (تلقائي)</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('YESTERDAY')}
                  className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${
                    preset === 'YESTERDAY' ? 'bg-amber-600 text-white shadow-md shadow-amber-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  أمس
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('WEEK')}
                  className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${
                    preset === 'WEEK' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  آخر 7 أيام
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('THIS_MONTH')}
                  className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${
                    preset === 'THIS_MONTH' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  هذا الشهر (من 1 للشهر)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('LAST_MONTH')}
                  className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${
                    preset === 'LAST_MONTH' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  الشهر السابق كاملاً
                </button>
                <button
                  type="button"
                  onClick={() => setPreset('CUSTOM')}
                  className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${
                    preset === 'CUSTOM' ? 'bg-gray-800 text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  فترة مخصصة 🗓️
                </button>
              </div>
            </div>

            {/* Selection Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-2 border-t border-gray-100">
              
              {/* Report Type Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">نوع التقرير المالي:</label>
                <select 
                  value={reportType}
                  onChange={(e) => handleReportTypeChange(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-indigo-600 outline-none text-sm bg-white"
                >
                  <optgroup label="🌟 التقارير الإجمالية الشاملة">
                    <option value="DAILY_FINANCIAL">التقرير المالي اليومي الشامل (ملخص اليوم والصندوق)</option>
                    <option value="MONTHLY_FINANCIAL">التقرير المالي الشهري الشامل (تقفيلة الشهر)</option>
                  </optgroup>
                  <optgroup label="📊 حركة المبيعات والمخزن">
                    <option value="SALES">تقرير المبيعات والأرباح حسب الأصناف</option>
                    <option value="SHIFTS">تقرير الورديات اليومية وتقفيل الدرج</option>
                    <option value="INVENTORY">تقرير تقييم المخزون الحالي</option>
                    <option value="LOW_STOCK">تقرير نواقص المخزون واحتياجات الشراء</option>
                  </optgroup>
                  <optgroup label="💰 المعاملات النقدية والديون">
                    <option value="EXPENSES">تقرير المصروفات والمنصرفات النقدية</option>
                    <option value="PURCHASES">تقرير المشتريات وفواتير الشراء</option>
                    <option value="SUPPLIERS">تقرير مديونيات وحسابات الموردين</option>
                    <option value="PATIENTS">تقرير أرصدة وحسابات المرضى (النشطين فقط)</option>
                  </optgroup>
                </select>
              </div>
              
              {/* Date Input: Single Day vs Custom Range */}
              {isSingleDayMode ? (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    اختر اليوم المراد استخراج تقريره:
                  </label>
                  <DatePicker 
                    selected={singleDate}
                    onChange={handleSingleDateChange}
                    dateFormat="dd/MM/yyyy"
                    locale="ar-EG"
                    className="w-full border-2 border-emerald-300 bg-emerald-50/40 rounded-xl p-3 font-black text-emerald-900 focus:border-emerald-600 outline-none text-sm text-center"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">من تاريخ:</label>
                    <DatePicker 
                      selected={startDate}
                      onChange={(date) => setStartDate(date)}
                      dateFormat="dd/MM/yyyy"
                      locale="ar-EG"
                      className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-indigo-600 outline-none text-sm text-center"
                      disabled={reportType === 'INVENTORY' || reportType === 'LOW_STOCK' || reportType === 'PATIENTS' || reportType === 'SUPPLIERS'}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">إلى تاريخ:</label>
                    <DatePicker 
                      selected={endDate}
                      onChange={(date) => setEndDate(date)}
                      dateFormat="dd/MM/yyyy"
                      locale="ar-EG"
                      className="w-full border-2 border-gray-200 rounded-xl p-3 font-bold text-gray-800 focus:border-indigo-600 outline-none text-sm text-center"
                      disabled={reportType === 'INVENTORY' || reportType === 'LOW_STOCK' || reportType === 'PATIENTS' || reportType === 'SUPPLIERS'}
                    />
                  </div>
                </>
              )}

              {/* Action Button */}
              {isSingleDayMode && (
                <div className="flex gap-2">
                  <button 
                    onClick={generateReport}
                    disabled={isGenerating}
                    className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50 transition-colors shadow-md shadow-indigo-200 text-sm"
                  >
                    <Filter size={18} />
                    <span>{isGenerating ? 'جاري الاستخراج...' : 'تحديث التقرير'}</span>
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="bg-gray-800 text-white font-black px-5 py-3 rounded-xl hover:bg-black flex items-center gap-2 transition-all text-sm"
                    title="طباعة التقرير"
                  >
                    <Printer size={18} />
                  </button>
                </div>
              )}
            </div>

            {!isSingleDayMode && (
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={generateReport}
                  disabled={isGenerating}
                  className="bg-indigo-600 text-white font-black px-8 py-3 rounded-xl hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-md shadow-indigo-200 text-sm"
                >
                  <Filter size={18} />
                  <span>{isGenerating ? 'جاري الاستخراج...' : 'استخراج التقرير'}</span>
                </button>
                <button 
                  onClick={handlePrint}
                  className="bg-gray-800 text-white font-black px-6 py-3 rounded-xl hover:bg-black flex items-center gap-2 transition-all text-sm"
                >
                  <Printer size={18} />
                  <span>طباعة A4</span>
                </button>
              </div>
            )}
          </div>

          {/* ================= REPORT DOCUMENT CONTAINER (PRINT READY) ================= */}
          {detailedData && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border-2 border-gray-200 print:border-none print:shadow-none print:p-0 space-y-8">
              
              {/* Formal Document Letterhead */}
              <div className="border-b-2 border-gray-900 pb-5 text-center relative">
                <div className="flex justify-between items-center mb-3 text-xs text-gray-700 font-bold">
                  <div className="text-right">
                    <div className="text-base font-black text-gray-900">المستشفى العسكري ق.م بالإسماعيلية</div>
                    <div className="text-xs text-indigo-900 font-bold">إدارة الكانتين والخدمات الغذائية</div>
                  </div>
                  <div className="text-left font-mono text-gray-500">
                    <div>تاريخ ووقت الطباعة:</div>
                    <div dir="ltr">{formatDateTime(new Date())}</div>
                  </div>
                </div>

                <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">
                  {reportType === 'DAILY_FINANCIAL' && 'التقرير المالي اليومي الشامل (ملخص اليوم والصندوق)'}
                  {reportType === 'MONTHLY_FINANCIAL' && 'التقرير المالي الشهري الشامل (تقفيلة الحسابات والأرباح)'}
                  {reportType === 'SALES' && 'تقرير المبيعات وحركة الأصناف والربحية'}
                  {reportType === 'SHIFTS' && 'تقرير الورديات اليومية وتقفيل الصندوق'}
                  {reportType === 'PURCHASES' && 'تقرير المشتريات وفواتير الموردين'}
                  {reportType === 'EXPENSES' && 'تقرير المصروفات والمنصرفات النقدية'}
                  {reportType === 'SUPPLIERS' && 'تقرير كشف مديونيات وحسابات الموردين'}
                  {reportType === 'PATIENTS' && 'تقرير أرصدة وحسابات المرضى (النشطين فقط)'}
                  {reportType === 'INVENTORY' && 'تقرير تقييم المخزون الحالي'}
                  {reportType === 'LOW_STOCK' && 'تقرير نواقص المخزون واحتياجات الشراء'}
                </h1>

                <p className="text-sm font-bold text-gray-600">
                  {isSingleDayMode 
                    ? `عن يوم: ${formatDate(startDate)}`
                    : `عن الفترة من: ${formatDate(startDate)} إلى ${formatDate(endDate)}`
                  }
                </p>
              </div>

              {/* ================= VIEW 1: DAILY FINANCIAL REPORT ================= */}
              {reportType === 'DAILY_FINANCIAL' && detailedData.summary && (
                <div className="space-y-8">
                  {/* KPI Cards Banner */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-center">
                      <div className="text-xs font-bold text-indigo-700 mb-1">إجمالي المبيعات (كاش + حساب)</div>
                      <div className="text-2xl font-black text-indigo-900">{(detailedData.summary.totalSales || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold">
                        كاش: {(detailedData.summary.cashSales || 0).toFixed(2)} | حساب: {(detailedData.summary.creditSales || 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                      <div className="text-xs font-bold text-gray-600 mb-1">تكلفة البضاعة المباعة (COGS)</div>
                      <div className="text-2xl font-black text-gray-800">{(detailedData.summary.costOfGoodsSold || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold">سعر الشراء للأصناف المباعة</div>
                    </div>

                    <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-100 text-center">
                      <div className="text-xs font-bold text-amber-700 mb-1">إجمالي المصروفات المنصرفة</div>
                      <div className="text-2xl font-black text-amber-900">{(detailedData.summary.totalExpenses || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold">
                        تشغيل: {(detailedData.summary.operationalExpenses || 0).toFixed(2)} | سداد مورد: {(detailedData.summary.supplierPayments || 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-300 text-center">
                      <div className="text-xs font-black text-emerald-800 mb-1">صافي ربح اليوم الفعلي ✨</div>
                      <div className="text-2xl font-black text-emerald-700">{(detailedData.summary.netProfit || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-emerald-600 mt-1 font-bold">مجمل الربح - المصروفات التشغيلية</div>
                    </div>
                  </div>

                  {/* Section A: Shifts & Cash Box Drawer */}
                  <div className="space-y-3">
                    <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-indigo-600 pr-3">
                      <span>1. حركة الورديات وتقفيل الصندوق لليوم</span>
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-gray-100 text-gray-700 font-bold">
                          <tr>
                            <th className="p-3">الوردية</th>
                            <th className="p-3">الحالة</th>
                            <th className="p-3">المسؤول</th>
                            <th className="p-3">وقت الفتح</th>
                            <th className="p-3">وقت الإغلاق</th>
                            <th className="p-3">عهدة البداية</th>
                            <th className="p-3">المتوقع بالدرج</th>
                            <th className="p-3">المحصي فعلياً</th>
                            <th className="p-3">الفارق</th>
                            <th className="p-3">المورد للخزينة</th>
                            <th className="p-3">المتبقي بالدرج</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-bold">
                          {detailedData.shifts?.map((s, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-3 font-mono">{s.shiftNumber}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${s.status.includes('مفتوحة') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="p-3">{s.openedBy}</td>
                              <td className="p-3 font-mono" dir="ltr">{formatDateTime(s.openedAt)}</td>
                              <td className="p-3 font-mono" dir="ltr">{s.closedAt ? formatDateTime(s.closedAt) : '-'}</td>
                              <td className="p-3">{s.startingCash} ج</td>
                              <td className="p-3">{s.systemBalance !== null ? `${s.systemBalance} ج` : '-'}</td>
                              <td className="p-3">{s.actualBalance !== null ? `${s.actualBalance} ج` : '-'}</td>
                              <td className={`p-3 ${s.discrepancy.includes('عجز') ? 'text-red-600' : s.discrepancy.includes('زيادة') ? 'text-green-600' : 'text-gray-600'}`}>
                                {s.discrepancy}
                              </td>
                              <td className="p-3 text-indigo-700">{s.transferredCash} ج</td>
                              <td className="p-3 text-emerald-700">{s.remainingCash} ج</td>
                            </tr>
                          ))}
                          {(!detailedData.shifts || detailedData.shifts.length === 0) && (
                            <tr>
                              <td colSpan="11" className="p-6 text-center text-gray-400">لا توجد ورديات مسجلة في هذا اليوم</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section B: Sold Products Breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-emerald-600 pr-3">
                      <span>2. حركة مبيعات الأصناف لليوم ({detailedData.products?.length || 0} صنف)</span>
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-gray-100 text-gray-700 font-bold">
                          <tr>
                            <th className="p-3">الصنف</th>
                            <th className="p-3">الكمية المباعة</th>
                            <th className="p-3">إجمالي التكلفة</th>
                            <th className="p-3">إجمالي الإيراد</th>
                            <th className="p-3">صافي الربح</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 font-bold">
                          {detailedData.products?.map((p, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-3 text-gray-900">{p.name}</td>
                              <td className="p-3 text-indigo-600">{p.quantity}</td>
                              <td className="p-3 text-gray-600">{(p.cost || 0).toFixed(2)} ج.م</td>
                              <td className="p-3 text-emerald-700">{(p.revenue || 0).toFixed(2)} ج.م</td>
                              <td className="p-3 text-indigo-800">{(p.profit || 0).toFixed(2)} ج.م</td>
                            </tr>
                          ))}
                          {(!detailedData.products || detailedData.products.length === 0) && (
                            <tr>
                              <td colSpan="5" className="p-6 text-center text-gray-400">لا توجد مبيعات أصناف في هذا اليوم</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section C: Expenses List */}
                  {detailedData.expenses && detailedData.expenses.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-amber-600 pr-3">
                        <span>3. بيان منصرفات ومسحوبات اليوم</span>
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-gray-100 text-gray-700 font-bold">
                            <tr>
                              <th className="p-3">التوقيت</th>
                              <th className="p-3">البند / التصنيف</th>
                              <th className="p-3">البيان</th>
                              <th className="p-3">القناة المالية</th>
                              <th className="p-3">المستخدم</th>
                              <th className="p-3">المبلغ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-bold">
                            {detailedData.expenses.map((exp, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="p-3 font-mono" dir="ltr">{formatDateTime(exp.date)}</td>
                                <td className="p-3 text-gray-800">{exp.category}</td>
                                <td className="p-3 text-gray-600">{exp.description}</td>
                                <td className="p-3 text-indigo-700">{exp.paymentMethod}</td>
                                <td className="p-3 text-gray-700">{exp.user}</td>
                                <td className="p-3 text-red-600 font-black">{exp.amount.toFixed(2)} ج.م</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= VIEW 2: MONTHLY FINANCIAL CLOSING REPORT ================= */}
              {reportType === 'MONTHLY_FINANCIAL' && detailedData.summary && (
                <div className="space-y-8">
                  {/* Monthly Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-center">
                      <div className="text-xs font-bold text-indigo-700 mb-1">إجمالي مبيعات الشهر</div>
                      <div className="text-2xl font-black text-indigo-900">{(detailedData.summary.totalSales || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold">
                        كاش: {(detailedData.summary.cashSales || 0).toFixed(2)} | حساب: {(detailedData.summary.creditSales || 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                      <div className="text-xs font-bold text-gray-600 mb-1">تكلفة البضاعة المباعة (COGS)</div>
                      <div className="text-2xl font-black text-gray-800">{(detailedData.summary.costOfGoodsSold || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold">مجمل الربح: {(detailedData.summary.grossProfit || 0).toFixed(2)} ج.م</div>
                    </div>

                    <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-100 text-center">
                      <div className="text-xs font-bold text-amber-700 mb-1">إجمالي المصروفات الشهرية</div>
                      <div className="text-2xl font-black text-amber-900">{(detailedData.summary.totalExpenses || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold">تشغيل: {(detailedData.summary.operationalExpenses || 0).toFixed(2)} ج.م</div>
                    </div>

                    <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-300 text-center">
                      <div className="text-xs font-black text-emerald-800 mb-1">صافي أرباح تقفيلة الشهر ✨</div>
                      <div className="text-2xl font-black text-emerald-700">{(detailedData.summary.netProfit || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-emerald-600 mt-1 font-bold">الأرباح الفعلية المحققة للشهر</div>
                    </div>
                  </div>

                  {/* Section: Treasury Balances at Month End */}
                  {detailedData.treasuryBalances && (
                    <div className="space-y-3">
                      <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-indigo-600 pr-3">
                        <span>1. أرصدة القنوات المالية الثلاث بنهاية الفترة</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {detailedData.treasuryBalances.map((m, idx) => (
                          <div key={idx} className="p-4 bg-white rounded-2xl border-2 border-gray-200 flex justify-between items-center shadow-sm">
                            <div>
                              <div className="text-xs text-gray-500 font-bold">{m.name}</div>
                              <div className="text-xl font-black text-gray-900 mt-0.5">{m.balance.toFixed(2)} ج.م</div>
                            </div>
                            <Wallet className="text-indigo-600" size={26} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section: Expenses by Category */}
                  {detailedData.expensesByCategory && detailedData.expensesByCategory.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-amber-600 pr-3">
                        <span>2. تفصيل المصروفات الشهرية حسب البنود والتصنيف</span>
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-gray-100 text-gray-700 font-bold">
                            <tr>
                              <th className="p-3">بند المصروف</th>
                              <th className="p-3">عدد الحركات</th>
                              <th className="p-3">إجمالي المنصرف</th>
                              <th className="p-3">النسبة من إجمالي المصروفات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-bold">
                            {detailedData.expensesByCategory.map((c, idx) => {
                              const pct = detailedData.summary.totalExpenses > 0 
                                ? ((c.total / detailedData.summary.totalExpenses) * 100).toFixed(1) 
                                : 0;
                              return (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="p-3 text-gray-900">{c.category}</td>
                                  <td className="p-3 text-gray-600">{c.count}</td>
                                  <td className="p-3 text-red-600 font-black">{c.total.toFixed(2)} ج.م</td>
                                  <td className="p-3 text-gray-500">{pct}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Section: Top 10 Products */}
                  {detailedData.topProducts && (
                    <div className="space-y-3">
                      <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-emerald-600 pr-3">
                        <span>3. أعلى 10 أصناف مبيعاً وربحية خلال الشهر</span>
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-right text-xs font-bold">
                          <thead className="bg-gray-100 text-gray-700">
                            <tr>
                              <th className="p-3">#</th>
                              <th className="p-3">الصنف</th>
                              <th className="p-3">الكمية المباعة</th>
                              <th className="p-3">إجمالي الإيراد</th>
                              <th className="p-3">صافي الربح المحقق</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {detailedData.topProducts.map((p, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="p-3 text-gray-400">{idx + 1}</td>
                                <td className="p-3 text-gray-900">{p.name}</td>
                                <td className="p-3 text-indigo-600">{p.quantity}</td>
                                <td className="p-3 text-emerald-700">{(p.revenue || 0).toFixed(2)} ج.م</td>
                                <td className="p-3 text-indigo-900">{(p.profit || 0).toFixed(2)} ج.م</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= VIEW 3: SHIFTS REPORT ================= */}
              {reportType === 'SHIFTS' && detailedData.data && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                      <div className="text-xs text-gray-500 font-bold mb-1">إجمالي عدد الورديات</div>
                      <div className="text-2xl font-black text-indigo-700">{detailedData.summary?.shiftsCount || detailedData.data.length}</div>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                      <div className="text-xs text-gray-500 font-bold mb-1">إجمالي النقدية الموردة للخزينة</div>
                      <div className="text-2xl font-black text-emerald-700">{(detailedData.summary?.totalTransferred || 0).toFixed(2)} ج.م</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                      <div className="text-xs text-gray-500 font-bold mb-1">إجمالي عهد البداية</div>
                      <div className="text-2xl font-black text-gray-800">{(detailedData.summary?.totalStarting || 0).toFixed(2)} ج.م</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-right text-xs font-bold">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          <th className="p-3">رقم الوردية</th>
                          <th className="p-3">الحالة</th>
                          <th className="p-3">فتح بواسطة</th>
                          <th className="p-3">وقت الفتح</th>
                          <th className="p-3">إغلاق بواسطة</th>
                          <th className="p-3">وقت الإغلاق</th>
                          <th className="p-3">عهدة البداية</th>
                          <th className="p-3">المتوقع بالدرج</th>
                          <th className="p-3">المحصي فعلياً</th>
                          <th className="p-3">الفارق</th>
                          <th className="p-3">المورد للخزينة</th>
                          <th className="p-3">المتبقي بالدرج</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailedData.data.map((s, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-3 font-mono">{s.shiftNumber}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${s.status === 'مفتوحة' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="p-3">{s.openedBy}</td>
                            <td className="p-3 font-mono" dir="ltr">{formatDateTime(s.openedAt)}</td>
                            <td className="p-3">{s.closedBy}</td>
                            <td className="p-3 font-mono" dir="ltr">{s.closedAt ? formatDateTime(s.closedAt) : '-'}</td>
                            <td className="p-3">{s.startingCash} ج</td>
                            <td className="p-3">{s.systemBalance !== '-' ? `${s.systemBalance} ج` : '-'}</td>
                            <td className="p-3">{s.actualBalance !== '-' ? `${s.actualBalance} ج` : '-'}</td>
                            <td className={`p-3 ${s.discrepancy.includes('عجز') ? 'text-red-600' : s.discrepancy.includes('زيادة') ? 'text-green-600' : 'text-gray-600'}`}>
                              {s.discrepancy}
                            </td>
                            <td className="p-3 text-indigo-700">{s.transferredCash} ج</td>
                            <td className="p-3 text-emerald-700">{s.remainingCash} ج</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ================= VIEW 4: SUPPLIERS DEBTS REPORT ================= */}
              {reportType === 'SUPPLIERS' && detailedData.data && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                      <div className="text-xs text-gray-500 font-bold mb-1">إجمالي الموردين</div>
                      <div className="text-2xl font-black text-indigo-700">{detailedData.summary?.totalSuppliers || detailedData.data.length}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                      <div className="text-xs text-gray-500 font-bold mb-1">إجمالي المشتريات التاريخية</div>
                      <div className="text-2xl font-black text-gray-800">{(detailedData.summary?.totalPurchases || 0).toFixed(2)} ج.م</div>
                    </div>
                    <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-200 text-center">
                      <div className="text-xs font-black text-red-700 mb-1">إجمالي ديون الموردين (علينا)</div>
                      <div className="text-2xl font-black text-red-600">{(detailedData.summary?.totalDebt || 0).toFixed(2)} ج.م</div>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-right text-xs font-bold">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          <th className="p-3">اسم المورد</th>
                          <th className="p-3">رقم الهاتف</th>
                          <th className="p-3">عدد الفواتير</th>
                          <th className="p-3">إجمالي المشتريات</th>
                          <th className="p-3">إجمالي المسدد</th>
                          <th className="p-3">المديونية المتبقية (علينا)</th>
                          <th className="p-3">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailedData.data.map((s, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="p-3 text-gray-900 font-black">{s.name}</td>
                            <td className="p-3 font-mono">{s.phone}</td>
                            <td className="p-3">{s.purchasesCount}</td>
                            <td className="p-3 text-gray-700">{s.totalPurchases.toFixed(2)} ج.م</td>
                            <td className="p-3 text-emerald-700">{s.totalPaid.toFixed(2)} ج.م</td>
                            <td className="p-3 text-red-600 font-black text-sm">{s.currentDebt.toFixed(2)} ج.م</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] ${s.currentDebt > 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ================= VIEW 5: GENERAL REPORTS (SALES, PURCHASES, EXPENSES, INVENTORY, LOW_STOCK, PATIENTS) ================= */}
              {!['DAILY_FINANCIAL', 'MONTHLY_FINANCIAL', 'SHIFTS', 'SUPPLIERS'].includes(reportType) && detailedData.data && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  {detailedData.summary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(detailedData.summary).map(([key, val]) => (
                        <div key={key} className="bg-gray-50 p-4 rounded-2xl border border-gray-200 text-center">
                          <p className="text-gray-500 font-bold mb-1 text-xs">
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
                          <p className="text-xl font-black text-indigo-700">
                            {typeof val === 'number' && !['invoiceCount', 'purchaseCount', 'productCount', 'expenseCount', 'totalItems', 'uniqueProducts', 'lowStockCount', 'totalPatients', 'activePatients'].includes(key)
                              ? `${val.toFixed(2)} ج.م` 
                              : val}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Standard Table */}
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-right text-xs font-bold border-collapse">
                      <thead className="bg-gray-100 text-gray-700">
                        <tr>
                          {reportType === 'SALES' && (
                            <>
                              <th className="p-3">الصنف</th>
                              <th className="p-3">الكمية المباعة</th>
                              <th className="p-3">تكلفة الشراء</th>
                              <th className="p-3">إجمالي الإيراد</th>
                              <th className="p-3">صافي الربح</th>
                            </>
                          )}
                          {reportType === 'PURCHASES' && (
                            <>
                              <th className="p-3">رقم الفاتورة</th>
                              <th className="p-3">التاريخ</th>
                              <th className="p-3">المورد</th>
                              <th className="p-3 w-1/3">الأصناف</th>
                              <th className="p-3">الإجمالي</th>
                              <th className="p-3">المدفوع</th>
                              <th className="p-3">المتبقي</th>
                            </>
                          )}
                          {reportType === 'EXPENSES' && (
                            <>
                              <th className="p-3">التاريخ</th>
                              <th className="p-3">التصنيف</th>
                              <th className="p-3 w-1/2">البيان</th>
                              <th className="p-3">وسيلة الدفع</th>
                              <th className="p-3">المبلغ</th>
                            </>
                          )}
                          {(reportType === 'INVENTORY' || reportType === 'LOW_STOCK') && (
                            <>
                              <th className="p-3">الصنف</th>
                              <th className="p-3">الوحدة</th>
                              <th className="p-3">الكمية الحالية</th>
                              <th className="p-3">سعر الشراء (التكلفة)</th>
                              <th className="p-3">القيمة الإجمالية</th>
                            </>
                          )}
                          {reportType === 'PATIENTS' && (
                            <>
                              <th className="p-3">رقم الملف</th>
                              <th className="p-3">اسم المريض</th>
                              <th className="p-3">الرقم الداخلي / الغرفة</th>
                              <th className="p-3">نوع الحساب</th>
                              <th className="p-3">الرصيد المالي</th>
                              <th className="p-3">الحالة</th>
                              <th className="p-3">ملاحظات</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detailedData.data.map((row, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            {reportType === 'SALES' && (
                              <>
                                <td className="p-3 text-gray-900 font-black">{row.name}</td>
                                <td className="p-3 text-indigo-600">{row.quantity}</td>
                                <td className="p-3 text-gray-600">{row.cost.toFixed(2)} ج</td>
                                <td className="p-3 text-emerald-700">{row.revenue.toFixed(2)} ج</td>
                                <td className="p-3 text-indigo-900">{row.profit.toFixed(2)} ج</td>
                              </>
                            )}
                            {reportType === 'PURCHASES' && (
                              <>
                                <td className="p-3 font-mono">{row.id}</td>
                                <td className="p-3 font-mono" dir="ltr">{formatDateTime(row.date)}</td>
                                <td className="p-3 font-black text-gray-900">{row.supplierName}</td>
                                <td className="p-3 text-gray-500 font-normal">{row.itemsSummary}</td>
                                <td className="p-3 text-indigo-700">{row.total.toFixed(2)} ج</td>
                                <td className="p-3 text-emerald-700">{row.paid.toFixed(2)} ج</td>
                                <td className="p-3 text-red-600">{row.remaining.toFixed(2)} ج</td>
                              </>
                            )}
                            {reportType === 'EXPENSES' && (
                              <>
                                <td className="p-3 font-mono" dir="ltr">{formatDate(row.date)}</td>
                                <td className="p-3 text-gray-900">{row.category}</td>
                                <td className="p-3 text-gray-600 font-normal">{row.description}</td>
                                <td className="p-3 text-indigo-700">{row.paymentMethod}</td>
                                <td className="p-3 text-red-600 font-black">{row.amount.toFixed(2)} ج</td>
                              </>
                            )}
                            {(reportType === 'INVENTORY' || reportType === 'LOW_STOCK') && (
                              <>
                                <td className="p-3 text-gray-900 font-black">{row.name}</td>
                                <td className="p-3 text-gray-500">{row.category || row.unit}</td>
                                <td className="p-3 text-indigo-700 font-black">{row.quantity}</td>
                                <td className="p-3 text-gray-700">{row.purchasePrice} ج</td>
                                <td className="p-3 text-emerald-700 font-black">{(row.totalValue || row.estimatedCost || 0).toFixed(2)} ج</td>
                              </>
                            )}
                            {reportType === 'PATIENTS' && (
                              <>
                                <td className="p-3 font-mono">{row.id}</td>
                                <td className="p-3 text-gray-900 font-black">{row.name}</td>
                                <td className="p-3 text-gray-500">{row.internalNumber}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                    row.currentDebt < 0 ? 'bg-red-100 text-red-800' : row.currentDebt > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {row.type}
                                  </span>
                                </td>
                                <td className={`p-3 text-sm font-black ${row.currentDebt < 0 ? 'text-red-600' : row.currentDebt > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
                                  {Math.abs(row.currentDebt).toFixed(2)} ج.م
                                </td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                                    {row.status}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-400 font-normal">{row.notes}</td>
                              </>
                            )}
                          </tr>
                        ))}
                        {detailedData.data.length === 0 && (
                          <tr>
                            <td colSpan="10" className="p-8 text-center text-gray-400 font-bold">
                              لا توجد بيانات مطابقة لخيارات البحث في هذه الفترة
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
