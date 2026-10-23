import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import client from '../../api/client';
import { 
  ShoppingCart, RotateCcw, PlusCircle, CreditCard, 
  AlertTriangle, TrendingUp, DollarSign, PackageOpen, 
  Users, Activity, Wallet, Search, Lock, Unlock, Clock
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useShift } from '../shifts/ShiftContext';

const formatDaysRemaining = (days) => {
  const d = Number(days);
  if (isNaN(d)) return '';
  if (d <= 0) return 'ينتهي اليوم!';
  if (d === 1) return 'متبقي يوم واحد';
  if (d === 2) return 'متبقي يومان';
  if (d >= 3 && d <= 10) return `متبقي ${d} أيام`;
  return `متبقي ${d} يوماً`;
};

const formatDaysExpired = (days) => {
  const d = Math.abs(Number(days));
  if (isNaN(d) || d === 0) return 'انتهى اليوم!';
  if (d === 1) return 'منتهي منذ يوم واحد';
  if (d === 2) return 'منتهي منذ يومين';
  if (d >= 3 && d <= 10) return `منتهي منذ ${d} أيام`;
  return `منتهي منذ ${d} يوماً`;
};

const HomePage = () => {
  const { user, isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const { isOpen, setIsOpeningModal, setIsClosingModal } = useShift();

  useEffect(() => {
    fetchHomeData();
  }, [isOpen]);

  const ShiftBanner = ({ shiftStats }) => {
    if (!shiftStats) return null;

    if (shiftStats.isOpen) {
      return (
        <div className="shift-banner-active bg-emerald-700 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 rounded-3xl p-6 text-white shadow-xl flex flex-col lg:flex-row items-center justify-between border-2 border-emerald-400/40 gap-6">
          <div className="flex-1 w-full">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="bg-emerald-900/60 bg-white/20 text-white px-3 py-1 rounded-full text-xs font-black border border-white/30 flex items-center gap-1.5 shadow-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse"></span>
                وردية نشطة #{shiftStats.shiftNumber}
              </span>
              {shiftStats.openedBy && (
                <span className="bg-emerald-900/40 px-2.5 py-0.5 rounded-md text-emerald-100 text-xs font-bold border border-emerald-500/30">
                  فتحها: {shiftStats.openedBy}
                </span>
              )}
              {shiftStats.openedAt && (
                <span className="text-emerald-100 text-xs font-mono font-bold">
                  بدأت: {new Date(shiftStats.openedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })} - {new Date(shiftStats.openedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <p className="text-emerald-100 font-black text-sm mb-1 tracking-wide">النقدية المتوقعة في درج الكاشير الآن (تقفيل الوردية)</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight drop-shadow-sm">{Number(shiftStats.expectedCash).toFixed(2)} <span className="text-2xl font-bold text-emerald-200">ج.م</span></h2>
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-xs font-black">
              {Number(shiftStats.startingCash) > 0 && (
                <span className="bg-emerald-900/60 bg-white/20 px-3 py-1.5 rounded-lg border border-white/30 text-emerald-100 shadow-sm">عهدة بداية اليومية: {Number(shiftStats.startingCash).toFixed(2)} ج.م</span>
              )}
              <span className="bg-emerald-900/50 bg-white/15 px-3 py-1.5 rounded-lg border border-white/20 shadow-sm">المبيعات النقدية: {Number(shiftStats.sales).toFixed(2)} ج.م</span>
              <span className="bg-emerald-900/50 bg-white/15 px-3 py-1.5 rounded-lg border border-white/20 shadow-sm">إيداعات المرضى: {Number(shiftStats.deposits).toFixed(2)} ج.م</span>
              <span className="bg-rose-900/60 bg-white/15 px-3 py-1.5 rounded-lg border border-rose-300/30 text-rose-100 shadow-sm">المنصرفات والمشتريات: {Number(shiftStats.expenses).toFixed(2)} ج.م</span>
              {Number(shiftStats.transfers) > 0 && (
                <span className="bg-amber-900/60 bg-white/15 px-3 py-1.5 rounded-lg border border-amber-300/30 text-amber-100 shadow-sm">توريدات وتحويلات سابقة: {Number(shiftStats.transfers).toFixed(2)} ج.م</span>
              )}
            </div>
          </div>
          {!isAdmin && (
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
              <button
                onClick={() => setIsClosingModal(true)}
                className="w-full lg:w-auto bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-4 rounded-2xl shadow-lg shadow-rose-950/40 transition-all flex items-center justify-center gap-2.5 border border-rose-400 cursor-pointer"
              >
                <Lock size={20} />
                <span>تقفيل اليومية (توريد الدرج)</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="shift-banner-closed bg-amber-700 bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 rounded-3xl p-6 text-white shadow-xl flex flex-col lg:flex-row items-center justify-between border-2 border-amber-400/40 gap-6">
        <div className="flex-1 w-full">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="bg-amber-900/60 bg-white/20 text-white px-3 py-1 rounded-full text-xs font-black border border-white/30 flex items-center gap-1.5 shadow-sm">
              <Lock size={14} />
              اليومية والوردية مغلقة
            </span>
            {shiftStats.lastShift && (
              <span className="bg-amber-900/40 px-2.5 py-0.5 rounded-md text-amber-100 text-xs font-bold border border-amber-500/30">
                آخر وردية مغلقة #{shiftStats.lastShift.shiftNumber} ({shiftStats.lastShift.userClosed?.fullName || 'الكاشير'})
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black mb-1">الوردية مغلقة حالياً - يلزم فتح اليومية لبدء المبيعات</h2>
          <p className="text-amber-100 text-sm font-bold">
            الرصيد المتوفر بالدرج حالياً: <span className="text-white font-black text-lg">{Number(shiftStats.expectedCash || 0).toFixed(2)} ج.م</span>
          </p>
        </div>
        {!isAdmin ? (
          <button
            onClick={() => setIsOpeningModal(true)}
            className="w-full lg:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-emerald-950/30 transition-all flex items-center justify-center gap-2 border border-emerald-400 cursor-pointer"
          >
            <Unlock size={22} />
            <span className="text-base">🔓 فتح يومية جديدة وبدء الوردية</span>
          </button>
        ) : (
          <span className="bg-amber-900/60 bg-white/20 text-white font-bold px-5 py-3 rounded-2xl text-xs border border-white/30 text-center">
            خاص بالكاشير فقط
          </span>
        )}
      </div>
    );
  };

  const fetchHomeData = async () => {
    try {
      const res = await client.get('/home');
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Quick Search for Sales/Cashier
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await client.get(`/products?search=${searchQuery}`);
        setSearchResults(res.data.data.slice(0, 5));
      } catch (err) {
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (loading || !data) return <div className="text-center mt-20 font-bold text-gray-500 text-xl animate-pulse">جاري تحميل لوحة التحكم...</div>;

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <img src="/logo.png" alt="المركز الوطني" className="w-6 h-6 object-contain rounded-full shadow-xs" />
            <span className="bg-emerald-50 text-[#007507] text-xs font-black px-3 py-1 rounded-full border border-emerald-200/80">
              المركز الوطني لعلاج الإدمان - المستشفى العسكري ق.م بالإسماعيلية
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900">أهلاً بك، {user.fullName} 👋</h1>
          <p className="text-slate-500 font-bold mt-1 text-sm">
            {isAdmin ? 'نظرة عامة على أداء الكانتين والرقابة المالية.' : 'مكتب التشغيل اليومي - وردية موفقة!'}
          </p>
        </div>
        {!isAdmin && (
          <div className="bg-emerald-50 text-[#007507] px-4 py-2 rounded-xl font-black text-xs flex items-center gap-2 border border-emerald-200/80">
            <Activity size={18} />
            متصل بالوردية الآن
          </div>
        )}
      </div>

      {!isAdmin ? (
        /* ================= SALES / CASHIER DASHBOARD ================= */
        <div className="space-y-6">
          
          {/* Shift Cash Widget */}
          <ShiftBanner shiftStats={data.shiftStats} />

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link to="/pos" className="bg-[#007507] hover:bg-[#003607] text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-lg shadow-md shadow-emerald-950/20">
              <ShoppingCart size={38} />
              <span className="font-black text-base">شاشة البيع (POS)</span>
            </Link>
            <Link to="/purchases/new" className="bg-slate-800 hover:bg-slate-900 text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-lg shadow-md">
              <PlusCircle size={38} />
              <span className="font-black text-base">فاتورة مشتريات</span>
            </Link>
            <Link to="/treasury" className="bg-rose-700 hover:bg-rose-800 text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-lg shadow-md">
              <CreditCard size={38} />
              <span className="font-black text-base">سحب مصروف</span>
            </Link>
            <Link to="/returns" className="bg-slate-700 hover:bg-slate-800 text-white rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all hover:shadow-lg shadow-md">
              <RotateCcw size={38} />
              <span className="font-black text-base">إرجاع بضاعة</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Low Stock Alerts */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="bg-slate-50 p-4 border-b border-slate-200/80 flex items-center gap-2 text-rose-700">
                <AlertTriangle size={22} />
                <h3 className="font-black text-base">نواقص تحتاج لشراء فوراً</h3>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto">
                {data.lowStockItems.length === 0 ? (
                  <p className="text-slate-400 font-bold text-center py-4 text-sm">المخزون ممتاز، لا توجد نواقص.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.lowStockItems.map(item => (
                      <li key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                        <span className="bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg font-black text-xs">
                          باقي: {item.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Expiry Alerts Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
              <div className="bg-slate-50 p-4 border-b border-slate-200/80 flex items-center justify-between text-slate-800">
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-amber-600" />
                  <h3 className="font-black text-base">صلاحية الأصناف</h3>
                </div>
                {(data.expiredCount > 0 || data.expiringSoonCount > 0) && (
                  <div className="flex gap-1.5">
                    {data.expiredCount > 0 && (
                      <span className="bg-rose-600 text-white text-xs px-2 py-0.5 rounded-full font-black">
                        {data.expiredCount} منتهي
                      </span>
                    )}
                    {data.expiringSoonCount > 0 && (
                      <span className="bg-amber-600 text-white text-xs px-2 py-0.5 rounded-full font-black">
                        {data.expiringSoonCount} وشيك
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="p-4 max-h-64 overflow-y-auto flex-1">
                {(data.expiredItems?.length === 0 && data.expiringSoonItems?.length === 0) ? (
                  <p className="text-slate-400 font-bold text-center py-6 text-sm">جميع تواريخ الصلاحية ممتازة وسارية 👍</p>
                ) : (
                  <div className="space-y-2">
                    {data.expiredItems?.map(item => (
                      <div key={item.id} className="flex justify-between items-center p-2.5 bg-rose-50/70 border border-rose-100 rounded-xl">
                        <div>
                          <p className="font-black text-rose-800 text-sm">{item.name}</p>
                          <p className="text-[11px] text-rose-600 font-bold">{formatDaysExpired(item.daysUntilExpiry ?? item.daysLeft)}</p>
                        </div>
                        <span className="bg-rose-600 text-white text-[10px] px-2 py-1 rounded-md font-black">
                          تالف / سحب
                        </span>
                      </div>
                    ))}
                    {data.expiringSoonItems?.map(item => (
                      <div key={item.id} className="flex justify-between items-center p-2.5 bg-amber-50/70 border border-amber-100 rounded-xl">
                        <div>
                          <p className="font-bold text-amber-900 text-sm">{item.name}</p>
                          <p className="text-[11px] text-amber-700 font-bold">{formatDaysRemaining(item.daysUntilExpiry ?? item.daysLeft)}</p>
                        </div>
                        <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-1 rounded-md font-bold">
                          أولوية بيع
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                <Link to="/products" className="text-xs font-bold text-[#007507] hover:text-[#003607]">
                  عرض كل الأصناف وإدارتها &larr;
                </Link>
              </div>
            </div>

            {/* Quick Search */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
              <h3 className="font-black text-slate-800 text-base mb-3 flex items-center gap-2">
                <Search className="text-[#007507]" size={20} />
                استعلام سريع عن صنف
              </h3>
              <input 
                type="text" 
                placeholder="اكتب اسم الصنف أو الباركود..." 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 font-bold text-sm focus:border-[#007507] focus:bg-white outline-none transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {isSearching && <div className="mt-3 text-slate-400 font-bold text-xs text-center">جاري البحث...</div>}
              {searchResults.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {searchResults.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-2.5 border border-slate-100 rounded-xl hover:bg-slate-50">
                      <div>
                        <div className="font-bold text-slate-800 text-sm">{p.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono font-bold">{p.internalCode}</div>
                      </div>
                      <div className="font-black text-[#007507]">{Number(p.sellingPrice || 0).toFixed(2)} ج.م</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      ) : (
        /* ================= ADMIN DASHBOARD ================= */
        <div className="space-y-6">
          {/* Shift Banner */}
          <ShiftBanner shiftStats={data.shiftStats} />

          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="bg-emerald-50 p-3 rounded-xl text-[#007507]"><PackageOpen size={24} /></div>
              <div>
                <p className="text-slate-500 font-bold text-xs">قيمة البضاعة</p>
                <h3 className="text-lg font-black text-slate-900">{Number(data.adminStats.inventoryValue || 0).toFixed(2)} ج.م</h3>
              </div>
            </div>
            
            {(() => {
              const profitVal = Number(data.adminStats.netProfit || 0);
              const isProfit = profitVal >= 0;
              return (
                <div className={`p-5 rounded-2xl border shadow-xs flex items-center gap-3 transition-colors ${
                  isProfit ? 'bg-white border-slate-200/80' : 'bg-red-50/60 border-red-200'
                }`}>
                  <div className={`p-3 rounded-xl ${
                    isProfit ? 'bg-emerald-50 text-[#007507]' : 'bg-red-100 text-red-600'
                  }`}><TrendingUp size={24} /></div>
                  <div>
                    <p className="text-slate-500 font-bold text-xs">صافي ربح الكانتين (الشهر)</p>
                    <h3 className={`text-lg font-black ${
                      isProfit ? 'text-[#007507]' : 'text-red-600'
                    }`}>{profitVal.toFixed(2)} ج.م</h3>
                  </div>
                </div>
              );
            })()}

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="bg-rose-50 p-3 rounded-xl text-rose-700"><Users size={24} /></div>
              <div>
                <p className="text-slate-500 font-bold text-xs">ديون المرضى (لنا)</p>
                <h3 className="text-lg font-black text-rose-700">{Number(data.adminStats.totalDebts || 0).toFixed(2)} ج.م</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="bg-amber-50 p-3 rounded-xl text-amber-700"><CreditCard size={24} /></div>
              <div>
                <p className="text-slate-500 font-bold text-xs">أموال المرضى (أمانات)</p>
                <h3 className="text-lg font-black text-amber-700">{Number(data.adminStats.totalPatientDeposits || 0).toFixed(2)} ج.م</h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
              <div className="bg-emerald-50 p-3 rounded-xl text-[#007507]"><Wallet size={24} /></div>
              <div>
                <p className="text-slate-500 font-bold text-xs">سيولة الخزائن</p>
                <h3 className="text-lg font-black text-slate-900">{Number(data.adminStats.treasuryBalance || 0).toFixed(2)} ج.م</h3>
              </div>
            </div>
          </div>

          {/* Expiry Warning Banner (if alerts exist) */}
          {data.adminStats?.totalExpiryAlerts > 0 && (
            <div className="expiry-banner-alert bg-red-700 bg-gradient-to-r from-red-600 via-amber-600 to-amber-700 text-white rounded-3xl p-5 shadow-lg border-2 border-red-300/60 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-900/60 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/20 shadow-sm">
                  <AlertTriangle size={28} className="text-white" />
                </div>
                <div>
                  <h4 className="font-black text-lg">تنبيه رقابي: أصناف تحتاج للمتابعة بشأن تاريخ الصلاحية</h4>
                  <p className="text-white/95 text-sm font-bold mt-1 flex flex-wrap gap-2">
                    {data.adminStats.expiredCount > 0 && (
                      <span className="bg-red-950 px-3 py-1 rounded-lg font-black text-white shadow-sm border border-red-400/40">
                        ⚠️ {data.adminStats.expiredCount} أصناف منتهية الصلاحية
                      </span>
                    )}
                    {data.adminStats.expiringSoonCount > 0 && (
                      <span className="bg-amber-950 px-3 py-1 rounded-lg font-black text-amber-100 shadow-sm border border-amber-400/40">
                        ⏳ {data.adminStats.expiringSoonCount} أصناف أوشكت على الانتهاء (خلال 5 أيام)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Link 
                to="/products"
                className="bg-white hover:bg-gray-100 text-gray-900 font-black px-6 py-3 rounded-2xl text-sm shadow-md transition-all whitespace-nowrap border border-gray-200"
              >
                فحص وإدارة الأصناف &larr;
              </Link>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Performance Metrics: Chart and Top Products */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Sales Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-100 col-span-1 md:col-span-2">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-gray-800">مبيعات آخر 7 أيام</h3>
                  <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold">آخر أسبوع</div>
                </div>
                <div className="h-72 w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontWeight: 'bold' }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="المبيعات" stroke="#4f46e5" strokeWidth={4} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#4f46e5', strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Products */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-100 col-span-1 md:col-span-2">
                <h3 className="text-lg font-black text-gray-800 mb-6">الأصناف الأكثر مبيعاً (هذا الشهر)</h3>
                <div className="space-y-4">
                  {data.topProducts.map((p, i) => (
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
                      <div className="font-black text-indigo-600">{Number(p.revenue || 0).toFixed(2)} ج.م</div>
                    </div>
                  ))}
                  {data.topProducts.length === 0 && (
                    <div className="text-center text-gray-400 font-bold py-8">لا توجد مبيعات هذا الشهر حتى الآن</div>
                  )}
                </div>
              </div>

            </div>
            {/* Top Debtors */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="bg-gray-50 p-4 border-b border-gray-100">
                <h3 className="font-black text-gray-800 text-lg">أعلى مرضى عليهم مديونيات</h3>
              </div>
              <div className="p-4 flex-1">
                <ul className="space-y-3">
                  {data.topDebtors.map((p, i) => (
                    <li key={p.id} className="flex justify-between items-center p-3 bg-red-50/50 rounded-xl border border-red-50">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-red-100 text-red-600 rounded-full flex items-center justify-center font-bold text-xs">{i+1}</div>
                        <span className="font-bold text-gray-800">{p.fullName}</span>
                      </div>
                      <span className="font-black text-red-600">{Math.abs(Number(p.currentDebt || 0)).toFixed(2)} ج.م</span>
                    </li>
                  ))}
                  {data.topDebtors.length === 0 && (
                    <li className="text-center text-gray-500 font-bold py-4">لا توجد ديون مسجلة</li>
                  )}
                </ul>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};

export default HomePage;
