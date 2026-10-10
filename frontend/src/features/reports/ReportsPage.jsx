import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, PackageOpen, Users, 
  ShoppingCart, Calendar, AlertTriangle, Download
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color, subValue, subLabel }) => (
  <div className="bg-white rounded-2xl p-6 border-2 border-gray-100 shadow-sm relative overflow-hidden group hover:border-indigo-100 transition-colors">
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
      <div className="flex items-center gap-2 text-sm mt-4 pt-4 border-t border-gray-50">
        <span className={`font-bold ${subValue > 0 ? 'text-green-500' : 'text-gray-500'}`}>
          {subValue}
        </span>
        <span className="text-gray-400 font-bold">{subLabel}</span>
      </div>
    )}
  </div>
);

const ReportsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('DASHBOARD');

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="مبيعات اليوم" 
              value={`${metrics.todaySales} ج.م`} 
              icon={ShoppingCart} 
              color="indigo" 
              subValue={`${metrics.monthSales} ج.م`}
              subLabel="إجمالي الشهر الحالي"
            />
            <StatCard 
              title="أرباح اليوم التقريبية" 
              value={`${metrics.todayProfit} ج.م`} 
              icon={TrendingUp} 
              color="emerald" 
              subValue="صافي"
              subLabel="بعد خصم التكلفة للمبيعات"
            />
            <StatCard 
              title="إجمالي المديونيات" 
              value={`${metrics.totalPatientDebt} ج.م`} 
              icon={Users} 
              color="red" 
              subValue={`${metrics.totalPatientDeposits} ج.م`}
              subLabel="أرصدة ودائع للمرضى"
            />
            <StatCard 
              title="نواقص المخزون" 
              value={metrics.lowStockCount} 
              icon={AlertTriangle} 
              color="amber" 
              subValue={`${metrics.inventoryValue} ج.م`}
              subLabel="قيمة المخزون الحالي"
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
        <div className="bg-white p-12 rounded-2xl shadow-sm border-2 border-dashed border-gray-300 text-center flex flex-col items-center justify-center h-96">
          <div className="bg-indigo-50 p-4 rounded-full mb-4">
            <Download size={48} className="text-indigo-400" />
          </div>
          <h3 className="text-2xl font-black text-gray-800 mb-2">تقارير الطباعة والتصدير</h3>
          <p className="text-gray-500 font-bold max-w-md">
            هذا القسم سيحتوي على فلاتر متقدمة لاستخراج تقارير المبيعات، الجرد، والأرباح وتصديرها بصيغة Word أو Excel أو طباعتها مباشرة.
          </p>
          <button className="mt-8 bg-indigo-600 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors">
            قريباً في التحديث القادم
          </button>
        </div>
      )}

    </div>
  );
};

export default ReportsPage;
