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
  ArrowDownRight, Layers, Sparkles, Store, Coffee, UtensilsCrossed, ChefHat, Package,
  RotateCcw, Calculator, Check, RefreshCw, Lock, Unlock, Edit3, ShieldAlert
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { exportToExcel } from '../../utils/excelExport';

const formatDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateISO = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const { user } = useAuth();
  const isAdmin = user?.role?.name === 'ADMIN' || user?.role?.permissions?.includes('ALL');

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

  // Filter states for Expenses and Purchases
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('ALL');
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [selectedPurchaseSupplier, setSelectedPurchaseSupplier] = useState('ALL');

  // Metadata lists
  const [paymentMethodsList, setPaymentMethodsList] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);

  // Modal for inspecting any invoice
  const [inspectingInvoice, setInspectingInvoice] = useState(null);

  // Kitchen Settlement State
  const [kitchenActualCounts, setKitchenActualCounts] = useState({});
  const [kitchenFilterMode, setKitchenFilterMode] = useState('AUXILIARY_ONLY'); // 'AUXILIARY_ONLY' or 'ALL'
  const [kitchenNotes, setKitchenNotes] = useState('');
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isKitchenEditMode, setIsKitchenEditMode] = useState(false);
  const [showEditConfirmModal, setShowEditConfirmModal] = useState(false);

  useEffect(() => {
    if (detailedData?.reportType === 'KITCHEN_CLOSING' && detailedData.materials) {
      if (detailedData.isClosed) {
        // Closed/locked snapshot mode
        setIsKitchenEditMode(false);
        const approvedCounts = {};
        detailedData.materials.forEach(m => {
          approvedCounts[m.id] = m.actualRemaining !== undefined ? m.actualRemaining : m.currentStock;
        });
        setKitchenActualCounts(approvedCounts);
        setKitchenNotes(detailedData.notes || '');
      } else {
        // Not closed yet: initial editable mode
        setIsKitchenEditMode(true);
        const initialCounts = {};
        detailedData.materials.forEach(m => {
          initialCounts[m.id] = m.currentStock;
        });
        setKitchenActualCounts(initialCounts);
        setKitchenNotes('');
      }
    }
  }, [detailedData]);

  useEffect(() => {
    fetchDashboard();
    fetchFilterOptions();
    // Auto-generate today's report on load!
    generateReportForDates('DAILY_FINANCIAL', new Date(), new Date());
  }, []);

  const fetchFilterOptions = async () => {
    try {
      const [balRes, catRes, supRes] = await Promise.all([
        client.get('/treasury/balances'),
        client.get('/treasury/expenses/categories'),
        client.get('/purchases/suppliers')
      ]);
      setPaymentMethodsList(balRes.data?.data || []);
      setCategoriesList(catRes.data?.data || []);
      setSuppliersList(supRes.data?.data || []);
    } catch (e) {
      console.error('Error fetching filter options:', e);
    }
  };

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
    let targetType = reportType;

    if (p === 'TODAY') {
      s = new Date();
      e = new Date();
      setSingleDate(s);
      if (reportType === 'MONTHLY_FINANCIAL') {
        targetType = 'DAILY_FINANCIAL';
        setReportType('DAILY_FINANCIAL');
      }
    } else if (p === 'YESTERDAY') {
      s = new Date();
      s.setDate(s.getDate() - 1);
      e = new Date(s);
      setSingleDate(s);
      if (reportType === 'MONTHLY_FINANCIAL') {
        targetType = 'DAILY_FINANCIAL';
        setReportType('DAILY_FINANCIAL');
      }
    } else if (p === 'WEEK') {
      s = new Date();
      s.setDate(s.getDate() - 7);
      e = new Date();
      if (reportType === 'MONTHLY_FINANCIAL') {
        targetType = 'DAILY_FINANCIAL';
        setReportType('DAILY_FINANCIAL');
      }
    } else if (p === 'THIS_MONTH') {
      s = new Date(now.getFullYear(), now.getMonth(), 1);
      e = new Date();
      if (reportType === 'DAILY_FINANCIAL') {
        targetType = 'MONTHLY_FINANCIAL';
        setReportType('MONTHLY_FINANCIAL');
      }
    } else if (p === 'LAST_MONTH') {
      s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      e = new Date(now.getFullYear(), now.getMonth(), 0);
      if (reportType === 'DAILY_FINANCIAL') {
        targetType = 'MONTHLY_FINANCIAL';
        setReportType('MONTHLY_FINANCIAL');
      }
    }

    setStartDate(s);
    setEndDate(e);

    // Auto-generate when switching preset for instant 1-click experience!
    generateReportForDates(targetType, s, e);
  };

  const handleSingleDateChange = (date) => {
    setSingleDate(date);
    setStartDate(date);
    setEndDate(date);
    generateReportForDates(reportType, date, date);
  };

  const generateReportForDates = async (typeToFetch, sDate, eDate, extraParams = {}) => {
    setIsGenerating(true);
    setDetailedData(null); // Clear previous report data immediately to avoid schema collisions
    try {
      const sStr = formatDateISO(sDate);
      const eStr = formatDateISO(eDate);
      let url = `/reports/detailed?type=${typeToFetch}&startDate=${sStr}&endDate=${eStr}`;

      const pm = extraParams.paymentMethodId !== undefined ? extraParams.paymentMethodId : selectedPaymentMethod;
      const cat = extraParams.categoryId !== undefined ? extraParams.categoryId : selectedExpenseCategory;
      const sup = extraParams.supplierId !== undefined ? extraParams.supplierId : selectedSupplier;
      const purchSup = extraParams.purchaseSupplierId !== undefined ? extraParams.purchaseSupplierId : selectedPurchaseSupplier;

      if (typeToFetch === 'EXPENSES') {
        if (pm && pm !== 'ALL') url += `&paymentMethodId=${pm}`;
        if (cat && cat !== 'ALL') url += `&categoryId=${cat}`;
        if (sup && sup !== 'ALL') url += `&supplierId=${sup}`;
      } else if (typeToFetch === 'PURCHASES') {
        if (purchSup && purchSup !== 'ALL') url += `&supplierId=${purchSup}`;
      }

      const res = await client.get(url);
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
    setDetailedData(null);
    if (newType === 'DAILY_FINANCIAL') {
      if (preset === 'THIS_MONTH' || preset === 'LAST_MONTH') {
        setPreset('TODAY');
        const today = new Date();
        setSingleDate(today);
        setStartDate(today);
        setEndDate(today);
        generateReportForDates(newType, today, today);
        return;
      }
    } else if (newType === 'MONTHLY_FINANCIAL' || newType === 'KITCHEN_CLOSING') {
      if (preset === 'TODAY' || preset === 'YESTERDAY') {
        setPreset('THIS_MONTH');
        const now = new Date();
        const s = new Date(now.getFullYear(), now.getMonth(), 1);
        const e = new Date();
        setStartDate(s);
        setEndDate(e);
        generateReportForDates(newType, s, e);
        return;
      }
    }
    generateReportForDates(newType, startDate, endDate);
  };

  const handleCommitKitchenSettlement = async () => {
    setIsSubmittingSettlement(true);
    try {
      const items = (detailedData?.materials || []).map(m => {
        const act = kitchenActualCounts[m.id] !== undefined ? Number(kitchenActualCounts[m.id]) : m.currentStock;
        return {
          productId: m.id,
          actualRemaining: act,
          reason: kitchenNotes || `تسوية وتقفيل خامات المطبخ لشهر ${formatDate(startDate)} إلى ${formatDate(endDate)}`
        };
      });

      const res = await client.post('/reports/kitchen-settlement', {
        startDate: formatDateISO(startDate),
        endDate: formatDateISO(endDate),
        notes: kitchenNotes,
        items,
        isUpdate: Boolean(detailedData?.isClosed)
      });

      toast.success(res.data.message || 'تم اعتماد تقفيلة المطبخ وتسوية المخزن بنجاح!');
      setShowConfirmModal(false);
      setIsKitchenEditMode(false);
      // Re-fetch report to display updated locked snapshot
      generateReportForDates('KITCHEN_CLOSING', startDate, endDate);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'حدث خطأ أثناء اعتماد التقفيلة');
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportToExcel = () => {
    if (!detailedData) {
      toast.error('لا توجد بيانات متاحة للتصدير حالياً');
      return;
    }

    try {
      const dateRangeStr = `${formatDate(startDate)}_إلى_${formatDate(endDate)}`;
      let filename = `تقرير_${reportType}_${dateRangeStr}`;
      let sheets = [];

      if (reportType === 'KITCHEN_CLOSING') {
        filename = `تقفيل_وجرد_خامات_المطبخ_${dateRangeStr}`;
        const materialsData = (detailedData.materials || []).map((m, idx) => {
          const act = kitchenActualCounts[m.id] !== undefined ? Number(kitchenActualCounts[m.id]) : (m.actualRemaining ?? m.currentStock);
          const used = Math.max(0, (m.openingStock + m.purchasesQty) - act);
          const cost = used * (m.unitCost || 0);
          return {
            'م': idx + 1,
            'كود الخامة': m.internalCode || '—',
            'اسم الخامة': m.name,
            'الوحدة': m.unit || 'قطعة',
            'رصيد أول الشهر': m.openingStock || 0,
            'وارد مشتريات الشهر': m.purchasesQty || 0,
            'الرصيد الدفتري': m.currentStock || 0,
            'الرصيد الفعلي المتبقي': act,
            'المستهلك الفعلي': Number(used.toFixed(2)),
            'سعر الوحدة (ج.م)': Number((m.unitCost || 0).toFixed(2)),
            'تكلفة الاستهلاك الفعلي (ج.م)': Number(cost.toFixed(2))
          };
        });

        const sum = detailedData.summary || {};
        const summaryData = [
          { 'البيان': 'إجمالي مبيعات السندوتشات', 'القيمة (ج.م)': sum.totalSandwichSales || 0 },
          { 'البيان': 'تكلفة اللحوم والقطع الأساسية المباعة', 'القيمة (ج.م)': sum.meatBaseCost || 0 },
          { 'البيان': 'وارد مشتريات الشهر من الخامات', 'القيمة (ج.م)': sum.totalPurchasesThisMonth || 0 },
          { 'البيان': 'تكلفة الخامات المكملة المستهلكة (بالجرد)', 'القيمة (ج.م)': sum.actualMaterialCostSettled || 0 },
          { 'البيان': 'صافي الربح الفعلي لمطبخ السندوتشات', 'القيمة (ج.م)': sum.netKitchenProfit || 0 },
          { 'البيان': 'نسبة هامش الربح', 'القيمة (ج.م)': `${sum.marginPercent || 0}%` },
          { 'البيان': 'إجمالي عدد السندوتشات المباعة', 'القيمة (ج.م)': sum.sandwichesSold || 0 },
          { 'البيان': 'حالة التقفيلة', 'القيمة (ج.م)': detailedData.isClosed ? 'معتمدة ومقفلة رسمياً 🔒' : 'مسودة قيد الجرد والتسوية' }
        ];

        sheets = [
          { name: 'جرد خامات المطبخ', data: materialsData },
          { name: 'ملخص أرباح المطبخ', data: summaryData }
        ];
      } else if (reportType === 'DAILY_FINANCIAL') {
        filename = `اليومية_الشاملة_${formatDate(startDate)}`;
        const s = detailedData.summary || {};
        const summaryData = [
          { 'المؤشر المالي': 'إجمالي المبيعات', 'المبلغ (ج.م)': s.totalSales || 0 },
          { 'المؤشر المالي': 'المرتجعات', 'المبلغ (ج.م)': s.totalReturns || 0 },
          { 'المؤشر المالي': 'صافي المبيعات', 'المبلغ (ج.م)': s.netSales || 0 },
          { 'المؤشر المالي': 'تكلفة البضاعة المباعة (COGS)', 'المبلغ (ج.م)': s.totalCost || 0 },
          { 'المؤشر المالي': 'مجمل ربح النشاط', 'المبلغ (ج.م)': s.netProfit || 0 },
          { 'المؤشر المالي': 'نسبة هامش الربح', 'المبلغ (ج.م)': `${s.profitMargin || 0}%` },
          { 'المؤشر المالي': 'المصروفات النقدية', 'المبلغ (ج.م)': s.totalExpenses || 0 },
          { 'المؤشر المالي': 'صافي الدخل النهائي', 'المبلغ (ج.م)': s.netIncome || 0 },
          { 'المؤشر المالي': 'مبيعات الكانتين', 'المبلغ (ج.م)': s.canteenSales || 0 },
          { 'المؤشر المالي': 'أرباح الكانتين', 'المبلغ (ج.م)': s.canteenProfit || 0 },
          { 'المؤشر المالي': 'مبيعات البوفيه', 'المبلغ (ج.م)': s.buffetSales || 0 },
          { 'المؤشر المالي': 'أرباح البوفيه', 'المبلغ (ج.م)': s.buffetProfit || 0 },
          { 'المؤشر المالي': 'مبيعات السندوتشات', 'المبلغ (ج.م)': s.sandwichSales || 0 },
          { 'المؤشر المالي': 'أرباح السندوتشات (مبدئي)', 'المبلغ (ج.م)': s.sandwichProfit || 0 }
        ];

        const paymentsData = (detailedData.paymentBreakdown || []).map(p => ({
          'طريقة الدفع': p.name || p.method,
          'إجمالي التحصيل (ج.م)': p.amount || 0
        }));

        const expensesData = (detailedData.expenses || []).map((e, idx) => ({
          'م': idx + 1,
          'التاريخ': formatDateTime(e.expenseDate),
          'التصنيف': e.category?.name || e.categoryName || '—',
          'البيان': e.description || '—',
          'المبلغ (ج.م)': e.amount || 0,
          'طريقة السداد': e.paymentMethod?.name || e.paymentMethodName || '—',
          'المسؤول': e.user?.fullName || e.user?.username || '—'
        }));

        sheets = [
          { name: 'ملخص اليومية', data: summaryData },
          { name: 'طرق التحصيل والخزينة', data: paymentsData }
        ];
        if (expensesData.length > 0) {
          sheets.push({ name: 'كشف المصروفات', data: expensesData });
        }
      } else if (reportType === 'MONTHLY_FINANCIAL') {
        filename = `التقرير_الشهري_الشامل_${dateRangeStr}`;
        const s = detailedData.summary || {};
        const summaryData = [
          { 'البند المالي': 'إجمالي الإيرادات (المبيعات)', 'القيمة (ج.م)': s.totalSales || 0 },
          { 'البند المالي': 'المرتجعات', 'القيمة (ج.م)': s.totalReturns || 0 },
          { 'البند المالي': 'صافي المبيعات', 'القيمة (ج.م)': s.netSales || 0 },
          { 'البند المالي': 'تكلفة البضاعة المباعة', 'القيمة (ج.م)': s.totalCost || 0 },
          { 'البند المالي': 'مجمل الأرباح', 'القيمة (ج.م)': s.netProfit || 0 },
          { 'البند المالي': 'إجمالي المصروفات والرواتب', 'القيمة (ج.م)': s.totalExpenses || 0 },
          { 'البند المالي': 'صافي الدخل والربح النهائي', 'القيمة (ج.م)': s.netIncome || 0 },
          { 'البند المالي': 'مبيعات الكانتين', 'القيمة (ج.م)': s.canteenSales || 0 },
          { 'البند المالي': 'صافي ربح الكانتين', 'القيمة (ج.م)': s.canteenProfit || 0 },
          { 'البند المالي': 'مبيعات البوفيه', 'القيمة (ج.م)': s.buffetSales || 0 },
          { 'البند المالي': 'صافي ربح البوفيه', 'القيمة (ج.م)': s.buffetProfit || 0 },
          { 'البند المالي': 'مبيعات السندوتشات', 'القيمة (ج.م)': s.sandwichSales || 0 },
          { 'البند المالي': 'صافي ربح المطبخ والسندوتشات', 'القيمة (ج.م)': s.sandwichProfit || 0 }
        ];

        sheets = [
          { name: 'الملخص المالي العام', data: summaryData }
        ];

        if (Array.isArray(detailedData.expenses) && detailedData.expenses.length > 0) {
          const expSheet = detailedData.expenses.map((e, idx) => ({
            'م': idx + 1,
            'التاريخ': formatDateTime(e.expenseDate),
            'التصنيف': e.category?.name || e.categoryName || '—',
            'البيان': e.description || '—',
            'المبلغ (ج.م)': e.amount || 0,
            'طريقة السداد': e.paymentMethod?.name || e.paymentMethodName || '—'
          }));
          sheets.push({ name: 'تفاصيل المصروفات', data: expSheet });
        }
      } else if (reportType === 'SHIFTS' && Array.isArray(detailedData.data)) {
        filename = `تقرير_الورديات_${dateRangeStr}`;
        const shiftsData = detailedData.data.map((s, idx) => ({
          'م': idx + 1,
          'رقم الوردية': s.shiftNumber || s.id,
          'الحالة': s.status,
          'فتح بواسطة': s.openedBy || '-',
          'وقت الفتح': formatDateTime(s.openedAt),
          'إغلاق بواسطة': s.closedBy || '-',
          'وقت الإغلاق': s.closedAt ? formatDateTime(s.closedAt) : '-',
          'عهدة البداية (ج.م)': Number(s.startingCash || 0).toFixed(2),
          'المتوقع بالدرج (ج.م)': s.systemBalance !== null && s.systemBalance !== '-' ? Number(s.systemBalance).toFixed(2) : '-',
          'المحصي فعلياً (ج.م)': s.actualBalance !== null && s.actualBalance !== '-' ? Number(s.actualBalance).toFixed(2) : '-',
          'الفارق / العجز': s.discrepancy || 'مطابق للنظام',
          'المورد للخزينة (ج.م)': Number(s.transferredCash || 0).toFixed(2),
          'المتبقي بالدرج (ج.م)': Number(s.remainingCash || 0).toFixed(2)
        }));
        sheets = [{ name: 'سجل الورديات', data: shiftsData }];
      } else if (reportType === 'SUPPLIERS' && Array.isArray(detailedData.data)) {
        filename = `كشف_حسابات_الموردين_${dateRangeStr}`;
        const supData = detailedData.data.map((s, idx) => ({
          'م': idx + 1,
          'اسم المورد': s.name,
          'رقم الهاتف': s.phone || '-',
          'عدد الفواتير': s.purchasesCount ?? 0,
          'إجمالي المشتريات (ج.م)': Number(s.totalPurchases || 0).toFixed(2),
          'إجمالي المسدد (ج.م)': Number(s.totalPaid || 0).toFixed(2),
          'المديونية المستحقة (ج.م)': Number(s.currentDebt || 0).toFixed(2),
          'الحالة': s.status || ((s.currentDebt || 0) > 0 ? 'مستحق له مديونية' : 'خالص الحساب')
        }));
        sheets = [{ name: 'كشف الموردين', data: supData }];
      } else if (Array.isArray(detailedData.data)) {
        const rowData = detailedData.data.map((row, idx) => {
          if (reportType === 'SALES') {
            filename = `تقرير_المبيعات_${dateRangeStr}`;
            return {
              'م': idx + 1,
              'اسم الصنف': row.name,
              'الكمية المباعة': row.quantity ?? 0,
              'تكلفة الشراء (ج.م)': Number(row.cost || 0).toFixed(2),
              'إجمالي الإيراد (ج.م)': Number(row.revenue || 0).toFixed(2),
              'صافي الربح (ج.م)': Number(row.profit || 0).toFixed(2)
            };
          } else if (reportType === 'PURCHASES') {
            filename = `تقرير_المشتريات_${dateRangeStr}`;
            return {
              'م': idx + 1,
              'رقم الفاتورة': row.id,
              'التاريخ والوقت': formatDateTime(row.date),
              'المورد': row.supplierName || 'غير محدد',
              'الأصناف': row.itemsSummary || '-',
              'الإجمالي (ج.م)': Number(row.total || 0).toFixed(2),
              'المدفوع (ج.م)': Number(row.paid || 0).toFixed(2),
              'المتبقي (ج.م)': Number(row.remaining || 0).toFixed(2),
              'الحالة': row.status || '-'
            };
          } else if (reportType === 'EXPENSES') {
            filename = `تقرير_المصروفات_${dateRangeStr}`;
            return {
              'م': idx + 1,
              'التاريخ والوقت': formatDateTime(row.date),
              'نوع المصروف': row.category || 'عام',
              'البيان والتفاصيل': row.description || '-',
              'القناة المالية': row.paymentMethod || 'نقدي (الدرج)',
              'المسؤول': row.user || 'النظام',
              'المبلغ (ج.م)': Number(row.amount || 0).toFixed(2)
            };
          } else if (reportType === 'INVENTORY' || reportType === 'LOW_STOCK') {
            filename = reportType === 'LOW_STOCK' ? `نواقص_المخزون_${dateRangeStr}` : `تقييم_المخزون_${dateRangeStr}`;
            return {
              'م': idx + 1,
              'الصنف': row.name,
              'الوحدة / التصنيف': row.category || row.unit || '-',
              'الكمية الحالية': row.quantity ?? 0,
              'سعر الشراء (ج.م)': Number(row.purchasePrice || 0).toFixed(2),
              'القيمة الإجمالية (ج.م)': Number(row.totalValue || row.estimatedCost || 0).toFixed(2)
            };
          } else if (reportType === 'PATIENTS') {
            filename = `كشف_حسابات_المرضى_${dateRangeStr}`;
            return {
              'م': idx + 1,
              'رقم الملف': row.id,
              'اسم المريض': row.name,
              'الرقم الداخلي / الغرفة': row.internalNumber || '-',
              'نوع الحساب': row.type,
              'الرصيد المالي (ج.م)': Math.abs(Number(row.currentDebt || 0)).toFixed(2),
              'طبيعة الرصيد': (row.currentDebt || 0) < 0 ? 'مديونية عليه' : (row.currentDebt || 0) > 0 ? 'رصيد دائن له' : 'خالص',
              'الحالة': row.status,
              'ملاحظات': row.notes || '-'
            };
          } else if (reportType === 'RAW_MATERIALS') {
            filename = `استهلاك_المواد_الخام_${dateRangeStr}`;
            const totalCost = Number((row.totalCostConsumed || 0) + (row.theoreticalSandwichCost || 0));
            return {
              'م': idx + 1,
              'المادة الخام': row.name,
              'الكود': row.code || '—',
              'الوحدة': row.unit || 'قطعة',
              'سعر التكلفة (ج.م)': Number(row.unitCost || 0).toFixed(2),
              'الرصيد المتبقي': row.currentStock ?? 0,
              'المستهلك بالبيع المباشر': row.consumedQty ?? 0,
              'الاستهلاك التقديري للسندوتشات': row.isSandwichAuxiliary ? (row.theoreticalSandwichUsage ?? 0) : '—',
              'إجمالي قيمة المستهلك (ج.م)': Number(totalCost.toFixed(2))
            };
          }
          return row;
        });

        sheets = [{ name: 'بيانات التقرير', data: rowData }];
      }

      if (sheets.length === 0) {
        toast.error('لا توجد بيانات مطابقة لتصديرها');
        return;
      }

      exportToExcel({ filename, sheets });
      toast.success('تم تصدير ملف الإكسيل بنجاح 📊');
    } catch (err) {
      console.error('Excel Export Error:', err);
      toast.error('حدث خطأ أثناء تصدير ملف الإكسيل');
    }
  };

  if (loading || !data) return (
    <div className="flex justify-center items-center h-96">
      <div className="text-2xl font-bold text-gray-400 animate-pulse">جاري تحضير الإحصائيات والتقارير...</div>
    </div>
  );

  const { metrics, chartData, topProducts } = data;
  const isSingleDayMode = (
    preset === 'TODAY' || 
    preset === 'YESTERDAY' || 
    (startDate && endDate && formatDate(startDate) === formatDate(endDate))
  );

  const selectedCatObj = categoriesList.find(c => String(c.id) === String(selectedExpenseCategory));
  const selectedPaymentMethodObj = paymentMethodsList.find(pm => String(pm.id) === String(selectedPaymentMethod));
  const selectedSupplierObj = suppliersList.find(s => String(s.id) === String(selectedSupplier));
  const isSupplierCategorySelected = selectedCatObj && selectedCatObj.name.includes('مورد');

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
                    <option value="DAILY_FINANCIAL">{isSingleDayMode ? 'التقرير المالي اليومي الشامل (ملخص اليوم والصندوق)' : 'التقرير المالي الشامل للفترة (ملخص الإيرادات والمصروفات)'}</option>
                    <option value="MONTHLY_FINANCIAL">التقرير المالي الشهري الشامل (تقفيلة الشهر)</option>
                    <option value="KITCHEN_CLOSING">🍔 تقفيل وجرد خامات المطبخ الفعلي (السندوتشات)</option>
                  </optgroup>
                  <optgroup label="📊 حركة المبيعات والمخزن">
                    <option value="SALES">تقرير المبيعات والأرباح حسب الأصناف</option>
                    <option value="RAW_MATERIALS">📦 تقرير استهلاك وحركة المواد الخام بالمطبخ والبوفيه</option>
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
                      onChange={(date) => {
                        setStartDate(date);
                        setPreset('CUSTOM');
                      }}
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
                      onChange={(date) => {
                        setEndDate(date);
                        setPreset('CUSTOM');
                      }}
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
                    onClick={handleExportToExcel}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-3 rounded-xl flex items-center gap-1.5 transition-all text-sm cursor-pointer shadow-md hover:shadow-lg whitespace-nowrap"
                    title="تصدير كشف التقرير كملف إكسيل Excel (.xlsx)"
                  >
                    <Download size={18} />
                    <span className="hidden sm:inline">إكسيل</span>
                  </button>
                  <button 
                    onClick={handlePrint}
                    className="bg-gray-800 text-white font-black px-4 py-3 rounded-xl hover:bg-black flex items-center gap-2 transition-all text-sm cursor-pointer"
                    title="طباعة التقرير"
                  >
                    <Printer size={18} />
                  </button>
                </div>
              )}
            </div>

            {/* Custom Sub-Filters for EXPENSES Report */}
            {reportType === 'EXPENSES' && (
              <div className="bg-amber-50/70 border-2 border-amber-200 rounded-2xl p-4 mt-2 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-amber-900 font-black text-xs border-b border-amber-200/80 pb-2">
                  <Filter size={16} className="text-amber-700" />
                  <span>تخصيص فلترة المصروفات والمنصرفات النقدية (من - إلى):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* 1. من (قناة الصرف) */}
                  <div>
                    <label className="block text-xs font-black text-amber-950 mb-1.5 flex items-center gap-1.5">
                      <Wallet size={14} className="text-amber-700" />
                      <span>من (قناة الصرف / المصدر):</span>
                    </label>
                    <select 
                      value={selectedPaymentMethod}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedPaymentMethod(val);
                        generateReportForDates(reportType, startDate, endDate, { 
                          paymentMethodId: val,
                          categoryId: selectedExpenseCategory,
                          supplierId: selectedSupplier
                        });
                      }}
                      className="w-full border-2 border-amber-300 rounded-xl p-2.5 bg-white font-bold text-xs text-gray-800 outline-none focus:border-indigo-600 shadow-sm"
                    >
                      <option value="ALL">الكل (جميع القنوات والخزائن)</option>
                      {paymentMethodsList.map(pm => (
                        <option key={pm.id} value={pm.id}>{pm.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 2. إلى (نوع وبند المصروف) */}
                  <div>
                    <label className="block text-xs font-black text-amber-950 mb-1.5 flex items-center gap-1.5">
                      <Layers size={14} className="text-amber-700" />
                      <span>إلى (نوع وبند المصروف):</span>
                    </label>
                    <select 
                      value={selectedExpenseCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedExpenseCategory(val);
                        const isSup = categoriesList.find(c => String(c.id) === String(val))?.name?.includes('مورد');
                        const supVal = isSup ? selectedSupplier : 'ALL';
                        if (!isSup) setSelectedSupplier('ALL');
                        generateReportForDates(reportType, startDate, endDate, { 
                          categoryId: val,
                          paymentMethodId: selectedPaymentMethod,
                          supplierId: supVal
                        });
                      }}
                      className="w-full border-2 border-amber-300 rounded-xl p-2.5 bg-white font-bold text-xs text-gray-800 outline-none focus:border-indigo-600 shadow-sm"
                    >
                      <option value="ALL">الكل (كافة بنود المصروفات)</option>
                      {categoriesList.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 3. المورد (يظهر إذا كان المختار سداد لمورد أو إذا ارتبط بمورد) */}
                  {isSupplierCategorySelected && (
                    <div className="animate-in fade-in duration-200">
                      <label className="block text-xs font-black text-indigo-950 mb-1.5 flex items-center gap-1.5">
                        <Truck size={14} className="text-indigo-700" />
                        <span>تحديد المورد:</span>
                      </label>
                      <select 
                        value={selectedSupplier}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedSupplier(val);
                          generateReportForDates(reportType, startDate, endDate, { 
                            supplierId: val,
                            paymentMethodId: selectedPaymentMethod,
                            categoryId: selectedExpenseCategory
                          });
                        }}
                        className="w-full border-2 border-indigo-300 rounded-xl p-2.5 bg-white font-bold text-xs text-gray-800 outline-none focus:border-indigo-600 shadow-sm"
                      >
                        <option value="ALL">الكل (جميع الموردين)</option>
                        {suppliersList.map(sup => (
                          <option key={sup.id} value={sup.id}>{sup.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Custom Sub-Filters for PURCHASES Report */}
            {reportType === 'PURCHASES' && (
              <div className="bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl p-4 mt-2 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-indigo-900 font-black text-xs border-b border-indigo-200/80 pb-2">
                  <Truck size={16} className="text-indigo-700" />
                  <span>فلترة فواتير المشتريات حسب المورد:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-black text-indigo-950 mb-1.5">تحديد المورد:</label>
                    <select 
                      value={selectedPurchaseSupplier}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedPurchaseSupplier(val);
                        generateReportForDates(reportType, startDate, endDate, { purchaseSupplierId: val });
                      }}
                      className="w-full border-2 border-indigo-300 rounded-xl p-2.5 bg-white font-bold text-xs text-gray-800 outline-none focus:border-indigo-600 shadow-sm"
                    >
                      <option value="ALL">الكل (جميع الموردين)</option>
                      {suppliersList.map(sup => (
                        <option key={sup.id} value={sup.id}>{sup.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {!isSingleDayMode && (
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  onClick={generateReport}
                  disabled={isGenerating}
                  className="bg-indigo-600 text-white font-black px-8 py-3 rounded-xl hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 transition-colors shadow-md shadow-indigo-200 text-sm cursor-pointer"
                >
                  <Filter size={18} />
                  <span>{isGenerating ? 'جاري الاستخراج...' : 'استخراج التقرير'}</span>
                </button>
                <button 
                  onClick={handleExportToExcel}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-xl flex items-center gap-2 transition-all text-sm cursor-pointer shadow-md hover:shadow-lg"
                  title="تصدير كشف التقرير كملف إكسيل Excel (.xlsx)"
                >
                  <Download size={18} />
                  <span>تصدير إكسيل 📊</span>
                </button>
                <button 
                  onClick={handlePrint}
                  className="bg-gray-800 text-white font-black px-6 py-3 rounded-xl hover:bg-black flex items-center gap-2 transition-all text-sm cursor-pointer"
                >
                  <Printer size={18} />
                  <span>طباعة A4</span>
                </button>
              </div>
            )}
          </div>

          {/* Loading state indicator */}
          {isGenerating && (
            <div className="bg-white p-16 rounded-3xl shadow-sm border-2 border-indigo-100 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <div className="text-xl font-black text-gray-800">جاري إعداد واستخراج بيانات التقرير...</div>
              <div className="text-xs font-bold text-gray-400 mt-1">المستشفى العسكري ق.م بالإسماعيلية - نظام الكانتين</div>
            </div>
          )}

          {/* ================= REPORT DOCUMENT CONTAINER (PRINT READY) ================= */}
          {!isGenerating && detailedData && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border-2 border-gray-200 print:border-none print:shadow-none print:p-0 space-y-8">
              
              {/* Formal Document Letterhead */}
              <div className="border-b-2 border-gray-900 pb-5 text-center relative">
                <div className="flex justify-between items-center mb-3 text-xs text-gray-700 font-bold">
                  <div className="text-right">
                    <div className="text-base font-black text-gray-900">المستشفى العسكري ق.م بالإسماعيلية</div>
                    <div className="text-xs text-indigo-900 font-bold">إدارة الكانتين والخدمات الغذائية</div>
                  </div>
                  <div className="flex items-center gap-2 print:hidden">
                    <button
                      type="button"
                      onClick={handleExportToExcel}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                      title="تصدير بيانات هذا التقرير كملف إكسيل (.xlsx)"
                    >
                      <Download size={14} />
                      <span>تصدير إكسيل 📊</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="px-3.5 py-1.5 bg-gray-800 hover:bg-black text-white rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      title="طباعة التقرير"
                    >
                      <Printer size={14} />
                      <span>طباعة A4</span>
                    </button>
                  </div>
                  <div className="text-left font-mono text-gray-500">
                    <div>تاريخ ووقت الطباعة:</div>
                    <div dir="ltr">{formatDateTime(new Date())}</div>
                  </div>
                </div>

                <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-2 tracking-tight">
                  {reportType === 'DAILY_FINANCIAL' && (
                    isSingleDayMode 
                      ? 'التقرير المالي اليومي الشامل (ملخص اليوم والصندوق)'
                      : 'التقرير المالي الشامل للفترة (ملخص الإيرادات والمصروفات والورديات)'
                  )}
                  {reportType === 'MONTHLY_FINANCIAL' && (
                    preset === 'LAST_MONTH'
                      ? 'التقرير المالي للشهر السابق (تقفيلة الحسابات والأرباح)'
                      : 'التقرير المالي الشهري الشامل (تقفيلة الحسابات والأرباح)'
                  )}
                  {reportType === 'SALES' && (isSingleDayMode ? 'تقرير المبيعات والربحية لليوم' : 'تقرير المبيعات وحركة الأصناف والربحية للفترة')}
                  {reportType === 'SHIFTS' && (isSingleDayMode ? 'تقرير ورديات اليوم وتقفيل الصندوق' : 'تقرير تدقيق الورديات التاريخي للفترة')}
                  {reportType === 'PURCHASES' && 'تقرير المشتريات وفواتير الموردين'}
                  {reportType === 'EXPENSES' && (isSingleDayMode ? 'تقرير المصروفات والمنصرفات لليوم' : 'تقرير المصروفات والمنصرفات النقدية للفترة')}
                  {reportType === 'SUPPLIERS' && 'تقرير كشف مديونيات وحسابات الموردين'}
                  {reportType === 'PATIENTS' && 'تقرير أرصدة وحسابات المرضى (النشطين فقط)'}
                  {reportType === 'INVENTORY' && 'تقرير تقييم المخزون الحالي'}
                  {reportType === 'LOW_STOCK' && 'تقرير نواقص المخزون واحتياجات الشراء'}
                  {reportType === 'KITCHEN_CLOSING' && '🍔 تقفيل وجرد خامات المطبخ الفعلي (السندوتشات)'}
                </h1>

                <p className="text-sm font-bold text-gray-600">
                  {isSingleDayMode 
                    ? `عن يوم: ${formatDate(startDate)}`
                    : `عن الفترة من: ${formatDate(startDate)} إلى ${formatDate(endDate)}`
                  }
                </p>
              </div>

              {/* ================= VIEW 1: DAILY FINANCIAL REPORT ================= */}
              {reportType === 'DAILY_FINANCIAL' && detailedData?.reportType === 'DAILY_FINANCIAL' && detailedData.summary && (
                <div className="space-y-8">
                  {/* KPI Cards Banner */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-center">
                      <div className="text-xs font-bold text-indigo-700 mb-1">إجمالي المبيعات (كاش + حساب)</div>
                      <div className="text-2xl font-black text-indigo-900">{Number(detailedData.summary.totalSales || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold">
                        كاش: {Number(detailedData.summary.cashSales || 0).toFixed(2)} | حساب: {Number(detailedData.summary.creditSales || 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                      <div className="text-xs font-bold text-gray-600 mb-1">تكلفة البضاعة المباعة (COGS)</div>
                      <div className="text-2xl font-black text-gray-800">{Number(detailedData.summary.costOfGoodsSold || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold">سعر الشراء للأصناف المباعة</div>
                    </div>

                    <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-100 text-center">
                      <div className="text-xs font-bold text-amber-700 mb-1">إجمالي المصروفات والمنصرفات</div>
                      <div className="text-2xl font-black text-amber-900">{Number(detailedData.summary.totalExpenses || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold flex flex-wrap items-center justify-center gap-1.5">
                        <span>نثريات: {Number(detailedData.summary.canteenExpenses ?? detailedData.summary.operationalExpenses ?? 0).toFixed(2)}</span>
                        {Number(detailedData.summary.hospitalExpenses || 0) > 0 && (
                          <>
                            <span>|</span>
                            <span className="text-amber-800 font-bold">حساب مستشفى: {Number(detailedData.summary.hospitalExpenses).toFixed(2)}</span>
                          </>
                        )}
                        {Number(detailedData.summary.supplierPayments || 0) > 0 && (
                          <>
                            <span>|</span>
                            <span>سداد مورد: {Number(detailedData.summary.supplierPayments).toFixed(2)}</span>
                          </>
                        )}
                        {Number(detailedData.summary.patientRefunds || 0) > 0 && (
                          <>
                            <span>|</span>
                            <span className="text-indigo-700 font-black">رد أمانات: {Number(detailedData.summary.patientRefunds).toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const profitVal = Number(detailedData.summary.netProfit || 0);
                      const isProfit = profitVal >= 0;
                      return (
                        <div className={`p-4 rounded-2xl border-2 text-center transition-colors ${
                          isProfit 
                            ? 'bg-emerald-50 border-emerald-300' 
                            : 'bg-rose-50 border-rose-300'
                        }`}>
                          <div className={`text-xs font-black mb-1 ${
                            isProfit ? 'text-emerald-800' : 'text-rose-800'
                          }`}>
                            {isSingleDayMode ? 'صافي ربح الكانتين اليوم ✨' : 'صافي ربح الكانتين للفترة ✨'}
                          </div>
                          <div className={`text-2xl font-black ${
                            isProfit ? 'text-emerald-700' : 'text-rose-600'
                          }`}>
                            {profitVal.toFixed(2)} ج.م
                          </div>
                          <div className={`text-[11px] mt-1 font-bold ${
                            isProfit ? 'text-emerald-600' : 'text-rose-500'
                          }`}>
                            {isProfit 
                              ? 'مجمل أرباح مبيعات الكانتين (المبيعات - تكلفة الشراء)' 
                              : 'عجز في أرباح المبيعات'
                            }
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 3 Independent Business Divisions Breakdown (Canteen, Buffet, Sandwich) */}
                  {detailedData.summary?.divisions && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-indigo-600 pr-3">
                          <span>أرباح ومبيعات الأقسام الثلاثة المستقلة (كانتين - بوفيه - سندوتشات)</span>
                        </h3>
                        <span className="text-xs text-gray-500 font-bold">
                          حسابات وأرباح كل قسم على حدة
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Canteen Division */}
                        <div className="bg-gradient-to-br from-sky-50 to-blue-50/50 p-4 rounded-2xl border-2 border-sky-200 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-sky-950 text-sm flex items-center gap-1.5">
                              <Store size={18} className="text-sky-600" />
                              <span>أرباح الكانتين (سناكس ومعلبات)</span>
                            </span>
                            <span className="text-xs bg-sky-100 text-sky-800 font-black px-2 py-0.5 rounded-lg font-mono">
                              {detailedData.summary.divisions.CANTEEN?.count || 0} قطعة
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 font-mono">
                            <div className="bg-white/80 p-2 rounded-xl border border-sky-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">المبيعات</div>
                              <div className="font-black text-gray-900">{Number(detailedData.summary.divisions.CANTEEN?.revenue || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-white/80 p-2 rounded-xl border border-sky-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">التكلفة</div>
                              <div className="font-black text-gray-700">{Number(detailedData.summary.divisions.CANTEEN?.cost || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-sky-100 p-2 rounded-xl border border-sky-200">
                              <div className="text-[10px] text-sky-800 font-bold font-sans">الربح الصافي</div>
                              <div className="font-black text-sky-950">+{Number(detailedData.summary.divisions.CANTEEN?.profit || 0).toFixed(2)}</div>
                              <div className="text-[9px] text-sky-700 font-bold font-sans">({detailedData.summary.divisions.CANTEEN?.margin || 0}%)</div>
                            </div>
                          </div>
                        </div>

                        {/* Buffet Division */}
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 rounded-2xl border-2 border-amber-200 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-amber-950 text-sm flex items-center gap-1.5">
                              <Coffee size={18} className="text-amber-600" />
                              <span>أرباح البوفيه والمشروبات</span>
                            </span>
                            <span className="text-xs bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-lg font-mono">
                              {detailedData.summary.divisions.BUFFET?.count || 0} كوب/مشروب
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 font-mono">
                            <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">المبيعات</div>
                              <div className="font-black text-gray-900">{Number(detailedData.summary.divisions.BUFFET?.revenue || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">التكلفة</div>
                              <div className="font-black text-gray-700">{Number(detailedData.summary.divisions.BUFFET?.cost || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-amber-100 p-2 rounded-xl border border-amber-200">
                              <div className="text-[10px] text-amber-900 font-bold font-sans">الربح الصافي</div>
                              <div className="font-black text-amber-950">+{Number(detailedData.summary.divisions.BUFFET?.profit || 0).toFixed(2)}</div>
                              <div className="text-[9px] text-amber-800 font-bold font-sans">({detailedData.summary.divisions.BUFFET?.margin || 0}%)</div>
                            </div>
                          </div>
                        </div>

                        {/* Sandwich Division */}
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50/50 p-4 rounded-2xl border-2 border-emerald-200 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-emerald-950 text-sm flex items-center gap-1.5">
                              <UtensilsCrossed size={18} className="text-emerald-600" />
                              <span>أرباح السندوتشات والمطبخ</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              {detailedData.isKitchenClosed ? (
                                <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                  <Lock size={10} />
                                  <span>معتمدة ومقفولة</span>
                                </span>
                              ) : (
                                <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span>⚠️ بانتظار التقفيل</span>
                                </span>
                              )}
                              <span className="text-xs bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded-lg font-mono">
                                {detailedData.summary.divisions.SANDWICH?.count || 0} سندوتش
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 font-mono">
                            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">المبيعات</div>
                              <div className="font-black text-gray-900">{Number(detailedData.summary.divisions.SANDWICH?.revenue || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">التكلفة</div>
                              <div className="font-black text-gray-700">{Number(detailedData.summary.divisions.SANDWICH?.cost || 0).toFixed(2)}</div>
                              {Number(detailedData.summary.divisions.SANDWICH?.auxiliaryCost || 0) > 0 ? (
                                <div className="text-[8px] text-emerald-700 font-bold font-sans truncate">
                                  (لحوم: {Number(detailedData.summary.divisions.SANDWICH?.baseCost || 0).toFixed(0)} | تسوية: {Number(detailedData.summary.divisions.SANDWICH?.auxiliaryCost || 0).toFixed(0)})
                                </div>
                              ) : (
                                <div className="text-[8px] text-amber-600 font-bold font-sans">
                                  (لحوم فقط - بانتظار تقفيل الخامات)
                                </div>
                              )}
                            </div>
                            <div className="bg-emerald-100 p-2 rounded-xl border border-emerald-200">
                              <div className="text-[10px] text-emerald-900 font-bold font-sans">الربح الصافي</div>
                              <div className="font-black text-emerald-950">+{Number(detailedData.summary.divisions.SANDWICH?.profit || 0).toFixed(2)}</div>
                              <div className="text-[9px] text-emerald-800 font-bold font-sans">({detailedData.summary.divisions.SANDWICH?.margin || 0}%)</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReportTypeChange('KITCHEN_CLOSING')}
                            className="w-full mt-1.5 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm"
                          >
                            <ChefHat size={15} />
                            <span>{detailedData.isKitchenClosed ? 'عرض تفاصيل تقفيلة المطبخ المعتمدة ↗️' : 'تقفيل وجرد خامات المطبخ الفعلي ⚡'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section A: Shifts & Cash Box Drawer */}
                  <div className="space-y-3">
                    <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-indigo-600 pr-3">
                      <span>1. حركة الورديات وتقفيل الصندوق {isSingleDayMode ? 'لليوم' : 'خلال الفترة'}</span>
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
                                <span className={`px-2 py-0.5 rounded-full text-[10px] ${s.status?.includes('مفتوحة') ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="p-3">{s.openedBy}</td>
                              <td className="p-3 font-mono" dir="ltr">{formatDateTime(s.openedAt)}</td>
                              <td className="p-3 font-mono" dir="ltr">{s.closedAt ? formatDateTime(s.closedAt) : '-'}</td>
                              <td className="p-3">{Number(s.startingCash || 0).toFixed(2)} ج</td>
                              <td className="p-3">{s.systemBalance !== null && s.systemBalance !== '-' ? `${Number(s.systemBalance).toFixed(2)} ج` : '-'}</td>
                              <td className="p-3">{s.actualBalance !== null && s.actualBalance !== '-' ? `${Number(s.actualBalance).toFixed(2)} ج` : '-'}</td>
                              <td className={`p-3 ${s.discrepancy?.includes?.('عجز') ? 'text-red-600' : s.discrepancy?.includes?.('زيادة') ? 'text-green-600' : 'text-gray-600'}`}>
                                {s.discrepancy || 'مطابق للنظام'}
                              </td>
                              <td className="p-3 text-indigo-700">{Number(s.transferredCash || 0).toFixed(2)} ج</td>
                              <td className="p-3 text-emerald-700">{Number(s.remainingCash || 0).toFixed(2)} ج</td>
                            </tr>
                          ))}
                          {(!detailedData.shifts || detailedData.shifts.length === 0) && (
                            <tr>
                              <td colSpan="11" className="p-6 text-center text-gray-400">لا توجد ورديات مسجلة في {isSingleDayMode ? 'هذا اليوم' : 'هذه الفترة'}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Section B: Sold Products Breakdown */}
                  <div className="space-y-3">
                    <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-emerald-600 pr-3">
                      <span>2. حركة مبيعات الأصناف {isSingleDayMode ? 'لليوم' : 'خلال الفترة'} ({detailedData.products?.length || 0} صنف)</span>
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
                              <td colSpan="5" className="p-6 text-center text-gray-400">لا توجد مبيعات أصناف في {isSingleDayMode ? 'هذا اليوم' : 'هذه الفترة'}</td>
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
                        <span>3. بيان منصرفات ومسحوبات {isSingleDayMode ? 'اليوم' : 'الفترة'}</span>
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
                                <td className="p-3 text-red-600 font-black">{Number(exp.amount || 0).toFixed(2)} ج.م</td>
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
              {reportType === 'MONTHLY_FINANCIAL' && detailedData?.reportType === 'MONTHLY_FINANCIAL' && detailedData.summary && (
                <div className="space-y-8">
                  {/* Monthly Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-100 text-center">
                      <div className="text-xs font-bold text-indigo-700 mb-1">إجمالي مبيعات الشهر</div>
                      <div className="text-2xl font-black text-indigo-900">{Number(detailedData.summary.totalSales || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold">
                        كاش: {Number(detailedData.summary.cashSales || 0).toFixed(2)} | حساب: {Number(detailedData.summary.creditSales || 0).toFixed(2)}
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                      <div className="text-xs font-bold text-gray-600 mb-1">تكلفة البضاعة المباعة (COGS)</div>
                      <div className="text-2xl font-black text-gray-800">{Number(detailedData.summary.costOfGoodsSold || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold">مجمل الربح: {Number(detailedData.summary.grossProfit || 0).toFixed(2)} ج.م</div>
                    </div>

                    <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-100 text-center">
                      <div className="text-xs font-bold text-amber-700 mb-1">إجمالي المصروفات الشهرية</div>
                      <div className="text-2xl font-black text-amber-900">{Number(detailedData.summary.totalExpenses || 0).toFixed(2)} ج.م</div>
                      <div className="text-[11px] text-gray-500 mt-1 font-bold flex flex-wrap items-center justify-center gap-1.5">
                        <span>نثريات: {Number(detailedData.summary.canteenExpenses ?? detailedData.summary.operationalExpenses ?? 0).toFixed(2)}</span>
                        {Number(detailedData.summary.hospitalExpenses || 0) > 0 && (
                          <>
                            <span>|</span>
                            <span className="text-amber-800 font-bold">حساب مستشفى: {Number(detailedData.summary.hospitalExpenses).toFixed(2)}</span>
                          </>
                        )}
                        {Number(detailedData.summary.supplierPayments || 0) > 0 && (
                          <>
                            <span>|</span>
                            <span>سداد موردين: {Number(detailedData.summary.supplierPayments).toFixed(2)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const profitVal = Number(detailedData.summary.netProfit || 0);
                      const isProfit = profitVal >= 0;
                      return (
                        <div className={`p-4 rounded-2xl border-2 text-center transition-colors ${
                          isProfit 
                            ? 'bg-emerald-50 border-emerald-300' 
                            : 'bg-rose-50 border-rose-300'
                        }`}>
                          <div className={`text-xs font-black mb-1 ${
                            isProfit ? 'text-emerald-800' : 'text-rose-800'
                          }`}>
                            صافي أرباح الكانتين للشهر ✨
                          </div>
                          <div className={`text-2xl font-black ${
                            isProfit ? 'text-emerald-700' : 'text-rose-600'
                          }`}>
                            {profitVal.toFixed(2)} ج.م
                          </div>
                          <div className={`text-[11px] mt-1 font-bold ${
                            isProfit ? 'text-emerald-600' : 'text-rose-500'
                          }`}>
                            {isProfit ? 'الأرباح الفعلية المحققة للكانتين' : 'صافي عجز / خسائر الكانتين'}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 3 Independent Business Divisions Breakdown (Canteen, Buffet, Sandwich) */}
                  {detailedData.summary?.divisions && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-indigo-600 pr-3">
                          <span>أرباح ومبيعات الأقسام الثلاثة في تقفيلة الشهر (كانتين - بوفيه - سندوتشات)</span>
                        </h3>
                        <span className="text-xs text-gray-500 font-bold">
                          أرباح كل قسم مستقلة تماماً
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Canteen Division */}
                        <div className="bg-gradient-to-br from-sky-50 to-blue-50/50 p-4 rounded-2xl border-2 border-sky-200 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-sky-950 text-sm flex items-center gap-1.5">
                              <Store size={18} className="text-sky-600" />
                              <span>أرباح الكانتين (سناكس ومعلبات)</span>
                            </span>
                            <span className="text-xs bg-sky-100 text-sky-800 font-black px-2 py-0.5 rounded-lg font-mono">
                              {detailedData.summary.divisions.CANTEEN?.count || 0} قطعة
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 font-mono">
                            <div className="bg-white/80 p-2 rounded-xl border border-sky-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">المبيعات</div>
                              <div className="font-black text-gray-900">{Number(detailedData.summary.divisions.CANTEEN?.revenue || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-white/80 p-2 rounded-xl border border-sky-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">التكلفة</div>
                              <div className="font-black text-gray-700">{Number(detailedData.summary.divisions.CANTEEN?.cost || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-sky-100 p-2 rounded-xl border border-sky-200">
                              <div className="text-[10px] text-sky-800 font-bold font-sans">الربح الصافي</div>
                              <div className="font-black text-sky-950">+{Number(detailedData.summary.divisions.CANTEEN?.profit || 0).toFixed(2)}</div>
                              <div className="text-[9px] text-sky-700 font-bold font-sans">({detailedData.summary.divisions.CANTEEN?.margin || 0}%)</div>
                            </div>
                          </div>
                        </div>

                        {/* Buffet Division */}
                        <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 p-4 rounded-2xl border-2 border-amber-200 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-amber-950 text-sm flex items-center gap-1.5">
                              <Coffee size={18} className="text-amber-600" />
                              <span>أرباح البوفيه والمشروبات</span>
                            </span>
                            <span className="text-xs bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-lg font-mono">
                              {detailedData.summary.divisions.BUFFET?.count || 0} كوب/مشروب
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 font-mono">
                            <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">المبيعات</div>
                              <div className="font-black text-gray-900">{Number(detailedData.summary.divisions.BUFFET?.revenue || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">التكلفة</div>
                              <div className="font-black text-gray-700">{Number(detailedData.summary.divisions.BUFFET?.cost || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-amber-100 p-2 rounded-xl border border-amber-200">
                              <div className="text-[10px] text-amber-900 font-bold font-sans">الربح الصافي</div>
                              <div className="font-black text-amber-950">+{Number(detailedData.summary.divisions.BUFFET?.profit || 0).toFixed(2)}</div>
                              <div className="text-[9px] text-amber-800 font-bold font-sans">({detailedData.summary.divisions.BUFFET?.margin || 0}%)</div>
                            </div>
                          </div>
                        </div>

                        {/* Sandwich Division */}
                        <div className="bg-gradient-to-br from-emerald-50 to-green-50/50 p-4 rounded-2xl border-2 border-emerald-200 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="font-black text-emerald-950 text-sm flex items-center gap-1.5">
                              <UtensilsCrossed size={18} className="text-emerald-600" />
                              <span>أرباح السندوتشات والمطبخ</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              {detailedData.isKitchenClosed ? (
                                <span className="text-[10px] bg-emerald-600 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                  <Lock size={10} />
                                  <span>معتمدة ومقفولة</span>
                                </span>
                              ) : (
                                <span className="text-[10px] bg-amber-500 text-white font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <span>⚠️ بانتظار التقفيل</span>
                                </span>
                              )}
                              <span className="text-xs bg-emerald-100 text-emerald-900 font-black px-2 py-0.5 rounded-lg font-mono">
                                {detailedData.summary.divisions.SANDWICH?.count || 0} سندوتش
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 font-mono">
                            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">المبيعات</div>
                              <div className="font-black text-gray-900">{Number(detailedData.summary.divisions.SANDWICH?.revenue || 0).toFixed(2)}</div>
                            </div>
                            <div className="bg-white/80 p-2 rounded-xl border border-emerald-100">
                              <div className="text-[10px] text-gray-500 font-bold font-sans">التكلفة</div>
                              <div className="font-black text-gray-700">{Number(detailedData.summary.divisions.SANDWICH?.cost || 0).toFixed(2)}</div>
                              {Number(detailedData.summary.divisions.SANDWICH?.auxiliaryCost || 0) > 0 ? (
                                <div className="text-[8px] text-emerald-700 font-bold font-sans truncate">
                                  (لحوم: {Number(detailedData.summary.divisions.SANDWICH?.baseCost || 0).toFixed(0)} | تسوية: {Number(detailedData.summary.divisions.SANDWICH?.auxiliaryCost || 0).toFixed(0)})
                                </div>
                              ) : (
                                <div className="text-[8px] text-amber-600 font-bold font-sans">
                                  (لحوم فقط - بانتظار تقفيل الخامات)
                                </div>
                              )}
                            </div>
                            <div className="bg-emerald-100 p-2 rounded-xl border border-emerald-200">
                              <div className="text-[10px] text-emerald-900 font-bold font-sans">الربح الصافي</div>
                              <div className="font-black text-emerald-950">+{Number(detailedData.summary.divisions.SANDWICH?.profit || 0).toFixed(2)}</div>
                              <div className="text-[9px] text-emerald-800 font-bold font-sans">({detailedData.summary.divisions.SANDWICH?.margin || 0}%)</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleReportTypeChange('KITCHEN_CLOSING')}
                            className="w-full mt-1.5 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-800 active:scale-98 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm"
                          >
                            <ChefHat size={15} />
                            <span>{detailedData.isKitchenClosed ? 'عرض تفاصيل تقفيلة المطبخ المعتمدة ↗️' : 'تقفيل وجرد خامات المطبخ الفعلي ⚡'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

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
                              <div className="text-xl font-black text-gray-900 mt-0.5">{Number(m.balance || 0).toFixed(2)} ج.م</div>
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
                              const totExp = Number(detailedData.summary.totalExpenses || 0);
                              const pct = totExp > 0 
                                ? ((Number(c.total || 0) / totExp) * 100).toFixed(1) 
                                : 0;
                              return (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="p-3 text-gray-900">{c.category}</td>
                                  <td className="p-3 text-gray-600">{c.count}</td>
                                  <td className="p-3 text-red-600 font-black">{Number(c.total || 0).toFixed(2)} ج.م</td>
                                  <td className="p-3 text-gray-500">{pct}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Section: All Sold Products */}
                  {detailedData.topProducts && (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                        <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-emerald-600 pr-3">
                          <span>3. بيان كافة الأصناف المباعة وربحيتها خلال الشهر</span>
                          <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                            {detailedData.topProducts.length} صنف مباع
                          </span>
                        </h3>
                        <div className="text-xs text-gray-500 font-bold">
                          إجمالي القطع المباعة: <span className="font-black text-indigo-700">{detailedData.topProducts.reduce((sum, p) => sum + Number(p.quantity || 0), 0)}</span> قطعة
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-xl border border-gray-200 print:overflow-visible print:border-none">
                        <table className="w-full text-right text-xs font-bold">
                          <thead className="bg-gray-100 text-gray-700">
                            <tr>
                              <th className="p-3">#</th>
                              <th className="p-3">الصنف</th>
                              <th className="p-3">الكمية المباعة</th>
                              <th className="p-3">إجمالي الإيراد</th>
                              <th className="p-3">تكلفة البضاعة (سعر الشراء)</th>
                              <th className="p-3">صافي الربح المحقق</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {detailedData.topProducts.map((p, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="p-3 text-gray-400">{idx + 1}</td>
                                <td className="p-3 text-gray-900">{p.name}</td>
                                <td className="p-3 text-indigo-600">{p.quantity}</td>
                                <td className="p-3 text-emerald-700">{Number(p.revenue || 0).toFixed(2)} ج.م</td>
                                <td className="p-3 text-gray-700">{Number(p.cost || 0).toFixed(2)} ج.م</td>
                                <td className={`p-3 ${Number(p.profit || 0) >= 0 ? 'text-indigo-900' : 'text-red-600'}`}>
                                  {Number(p.profit || 0).toFixed(2)} ج.م
                                </td>
                              </tr>
                            ))}
                            {detailedData.topProducts.length === 0 && (
                              <tr>
                                <td colSpan="6" className="p-6 text-center text-gray-400 font-bold">
                                  لا توجد مبيعات أصناف مسجلة خلال هذا الشهر.
                                </td>
                              </tr>
                            )}
                          </tbody>
                          {detailedData.topProducts.length > 0 && (
                            <tfoot className="bg-gray-50 font-black text-gray-900 border-t-2 border-gray-200">
                              <tr>
                                <td colSpan="2" className="p-3 text-gray-800">
                                  الإجمالي ({detailedData.topProducts.length} صنف)
                                </td>
                                <td className="p-3 text-indigo-700">
                                  {detailedData.topProducts.reduce((sum, p) => sum + Number(p.quantity || 0), 0)} قطعة
                                </td>
                                <td className="p-3 text-emerald-700">
                                  {detailedData.topProducts.reduce((sum, p) => sum + Number(p.revenue || 0), 0).toFixed(2)} ج.م
                                </td>
                                <td className="p-3 text-gray-800">
                                  {detailedData.topProducts.reduce((sum, p) => sum + Number(p.cost || 0), 0).toFixed(2)} ج.م
                                </td>
                                <td className="p-3 text-indigo-900">
                                  {detailedData.topProducts.reduce((sum, p) => sum + Number(p.profit || 0), 0).toFixed(2)} ج.م
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Section 4: Kitchen Month-End Closing & Auxiliary Inventory Details */}
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                      <h3 className="text-base font-black text-gray-800 flex items-center gap-2 border-r-4 border-emerald-600 pr-3">
                        <ChefHat className="text-emerald-600" size={20} />
                        <span>4. تفاصيل تقفيلة مطبخ السندوتشات الشهرية</span>
                        {detailedData.isKitchenClosed ? (
                          <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 border border-emerald-300">
                            <Lock size={12} />
                            <span>معتمدة ومغلقة</span>
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 border border-amber-300">
                            <AlertTriangle size={12} />
                            <span>بانتظار التقفيل الفعلي</span>
                          </span>
                        )}
                      </h3>
                      <button
                        type="button"
                        onClick={() => handleReportTypeChange('KITCHEN_CLOSING')}
                        className="text-xs font-black text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer self-start sm:self-auto"
                      >
                        <span>{detailedData.isKitchenClosed ? 'فتح كشف جرد المطبخ الكامل ↗️' : 'الانتقال لتقفيل المطبخ والجرد الفعلي ⚡'}</span>
                      </button>
                    </div>

                    {detailedData.isKitchenClosed && detailedData.kitchenClosing ? (
                      <div className="bg-white rounded-2xl border-2 border-emerald-200 p-5 shadow-sm space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
                          <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            <span>
                              تم إغلاق واعتماد تقفيلة المطبخ لشهر <strong className="font-mono text-emerald-900">{detailedData.monthKey}</strong> بتاريخ <span className="font-mono">{formatDateTime(detailedData.kitchenClosing.closedAt)}</span> بواسطة <strong className="text-emerald-900">{detailedData.kitchenClosing.closedBy?.fullName || 'الإدارة'}</strong>
                              {detailedData.kitchenClosing.updatedAt && (
                                <span className="text-amber-700 block sm:inline sm:mr-2"> (آخر تعديل: {formatDateTime(detailedData.kitchenClosing.updatedAt)} بواسطة {detailedData.kitchenClosing.updatedBy?.fullName})</span>
                              )}
                            </span>
                          </div>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                handleReportTypeChange('KITCHEN_CLOSING');
                                setShowEditConfirmModal(true);
                              }}
                              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                            >
                              <Edit3 size={14} />
                              <span>تعديل التقفيلة ✏️</span>
                            </button>
                          )}
                        </div>

                        {/* 4 Cards Summary of Kitchen */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                          <div className="p-3 bg-sky-50 rounded-xl border border-sky-200">
                            <div className="text-[11px] font-bold text-sky-800">إيراد السندوتشات</div>
                            <div className="text-lg font-black text-sky-950 mt-0.5">
                              {Number(detailedData.kitchenClosing.summary?.totalSandwichRevenue || 0).toFixed(2)} ج.م
                            </div>
                            <div className="text-[10px] text-sky-700 font-bold">({detailedData.kitchenClosing.summary?.totalSandwichesSold || 0} سندوتش)</div>
                          </div>

                          <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="text-[11px] font-bold text-gray-600">تكلفة اللحوم الأساسية</div>
                            <div className="text-lg font-black text-gray-900 mt-0.5">
                              {Number(detailedData.kitchenClosing.summary?.totalBaseCost || 0).toFixed(2)} ج.م
                            </div>
                            <div className="text-[10px] text-gray-500 font-bold">خصم فوري بالبيع</div>
                          </div>

                          <div className="p-3 bg-amber-50 rounded-xl border border-amber-300">
                            <div className="text-[11px] font-bold text-amber-900">تكلفة الخامات المكملة (الجرد)</div>
                            <div className="text-lg font-black text-amber-950 mt-0.5">
                              {Number(detailedData.kitchenClosing.summary?.totalAuxConsumedCost || 0).toFixed(2)} ج.م
                            </div>
                            <div className="text-[10px] text-amber-800 font-bold">معتمدة ومغلقة</div>
                          </div>

                          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300">
                            <div className="text-[11px] font-bold text-emerald-800">صافي ربح المطبخ النهائي</div>
                            <div className="text-lg font-black text-emerald-700 mt-0.5">
                              +{Number(detailedData.kitchenClosing.summary?.netKitchenProfit || 0).toFixed(2)} ج.م
                            </div>
                            <div className="text-[10px] text-emerald-600 font-black">
                              هامش الربح: {detailedData.kitchenClosing.summary?.profitMargin || 0}%
                            </div>
                          </div>
                        </div>

                        {/* Approved Materials Table Preview */}
                        {detailedData.kitchenClosing.materials && detailedData.kitchenClosing.materials.length > 0 && (
                          <div className="overflow-x-auto rounded-xl border border-gray-200">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-gray-100 text-gray-700 font-bold">
                                <tr>
                                  <th className="p-2.5">الخامة المكملة</th>
                                  <th className="p-2.5">الوحدة</th>
                                  <th className="p-2.5">سعر الشراء</th>
                                  <th className="p-2.5 bg-emerald-50/80 text-emerald-950 font-black">الرصيد الفعلي المعتمد</th>
                                  <th className="p-2.5">المستهلك المعتمد</th>
                                  <th className="p-2.5 text-amber-900 font-black">تكلفة الاستهلاك المعتمدة</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 font-bold">
                                {detailedData.kitchenClosing.materials.filter(m => !m.isBase).map((m, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="p-2.5 text-gray-900 flex items-center gap-1.5">
                                      <span>{m.name}</span>
                                      <span className="text-[10px] text-gray-400 font-mono">({m.code})</span>
                                    </td>
                                    <td className="p-2.5 text-gray-600 font-mono">{m.unit}</td>
                                    <td className="p-2.5 font-mono">{Number(m.unitCost || 0).toFixed(2)} ج.م</td>
                                    <td className="p-2.5 bg-emerald-50/50 font-mono font-black text-emerald-950">
                                      {m.actualRemaining} {m.unit}
                                    </td>
                                    <td className="p-2.5 font-mono text-gray-700">
                                      {m.consumedQty > 0 ? `-${m.consumedQty}` : m.consumedQty < 0 ? `+${Math.abs(m.consumedQty)} (فائض)` : 'مطابق'}
                                    </td>
                                    <td className="p-2.5 font-mono font-black text-amber-900">
                                      {Number(m.consumedCost || 0).toFixed(2)} ج.م
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl mt-0.5">
                            <AlertTriangle size={22} />
                          </div>
                          <div>
                            <h4 className="font-black text-amber-950 text-sm">تقفيلة وجرد مطبخ السندوتشات لهذا الشهر لم تُعتمد بعد!</h4>
                            <p className="text-xs text-amber-800 font-bold mt-1 leading-relaxed">
                              صافي أرباح السندوتشات المعروضة في التقرير أعلاه أولية، ولا تتضمن تكلفة الخامات المكملة المستهلكة (العيش، الاستربس المفتوح، الخضار، التوابل، الصوصات).
                              اضغط على زر التقفيل لإدخال المتبقي الفعلي واعتماد الأرباح الدقيقة وتثبيتها بشكل رسمي.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleReportTypeChange('KITCHEN_CLOSING')}
                          className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer shrink-0"
                        >
                          <ChefHat size={16} />
                          <span>جرد واعتماد تقفيلة المطبخ الآن ⚡</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ================= VIEW: KITCHEN MONTH-END CLOSING & SETTLEMENT ================= */}
              {reportType === 'KITCHEN_CLOSING' && detailedData?.reportType === 'KITCHEN_CLOSING' && detailedData.summary && (() => {
                const displayedMaterials = kitchenFilterMode === 'AUXILIARY_ONLY'
                  ? (detailedData.auxiliaryMaterials || [])
                  : (detailedData.materials || []);

                const auxConsumedCost = (detailedData.auxiliaryMaterials || []).reduce((sum, m) => {
                  const act = kitchenActualCounts[m.id] !== undefined ? Number(kitchenActualCounts[m.id] || 0) : m.currentStock;
                  const diff = m.currentStock - act;
                  return sum + (diff > 0 ? diff * m.unitCost : 0);
                }, 0);

                const auxSurplusCost = (detailedData.auxiliaryMaterials || []).reduce((sum, m) => {
                  const act = kitchenActualCounts[m.id] !== undefined ? Number(kitchenActualCounts[m.id] || 0) : m.currentStock;
                  const diff = act - m.currentStock;
                  return sum + (diff > 0 ? diff * m.unitCost : 0);
                }, 0);

                const netConsumedAuxCost = Math.max(0, auxConsumedCost - auxSurplusCost);
                const totalRev = Number(detailedData.summary.totalSandwichRevenue || 0);
                const totalBaseCost = Number(detailedData.summary.totalBaseCost || 0);
                const liveTotalCost = totalBaseCost + netConsumedAuxCost;
                const liveNetProfit = totalRev - liveTotalCost;
                const liveMargin = totalRev > 0 ? ((liveNetProfit / totalRev) * 100).toFixed(1) : 0;
                const isProfitable = liveNetProfit >= 0;

                return (
                  <div className="space-y-6">
                    {/* 1. Header Hero Card with Rules Explanation */}
                    <div className="bg-gradient-to-br from-emerald-900 via-teal-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="bg-emerald-500/30 text-emerald-300 text-xs font-black px-3 py-1 rounded-full border border-emerald-400/30 flex items-center gap-1.5">
                              <ChefHat size={14} />
                              <span>إدارة وحوكمة مطبخ السندوتشات</span>
                            </span>
                            <span className="bg-white/10 text-gray-300 text-xs font-bold px-3 py-1 rounded-full">
                              الفترة: {formatDate(startDate)} إلى {formatDate(endDate)}
                            </span>
                            {detailedData.isClosed && (
                              <span className="bg-emerald-500 text-gray-950 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                                <Lock size={12} />
                                <span>معتمدة ومغلقة رسمياً</span>
                              </span>
                            )}
                          </div>
                          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                            <span>
                              {detailedData.isClosed 
                                ? `🍔 تقفيل وجرد خامات المطبخ لشهر ${detailedData.monthKey || ''} (معتمد ومغلق 🔒)`
                                : '🍔 تقفيل وجرد خامات المطبخ الشهري (السندوتشات)'}
                            </span>
                          </h2>
                          {detailedData.isClosed ? (
                            <p className="text-gray-200 text-xs md:text-sm mt-2 max-w-3xl leading-relaxed">
                              🔒 <strong className="text-emerald-300">تقفيلة معتمدة ومقفولة:</strong> تم إغلاق واعتماد جرد خامات المطبخ لهذا الشهر بتاريخ <span className="font-mono text-white font-bold">{formatDateTime(detailedData.closedAt)}</span> بواسطة <strong className="text-white font-black">{detailedData.closedBy?.fullName || 'الإدارة'}</strong>. تم ترحيل كافة التفاصيل للتقرير المالي الشهري وتثبيت الأرباح لمنع أي تغيير غير مقصود.
                              {detailedData.updatedAt && (
                                <span className="text-amber-300 block font-bold mt-1">✏️ آخر تعديل مسجل بتاريخ: {formatDateTime(detailedData.updatedAt)} بواسطة {detailedData.updatedBy?.fullName || 'الإدارة'}</span>
                              )}
                            </p>
                          ) : (
                            <p className="text-gray-300 text-xs md:text-sm mt-2 max-w-3xl leading-relaxed">
                              💡 <strong className="text-emerald-300">الآلية المعتمدة:</strong> عند بيع السندوتش بالكاشير، يتم خصم قطعة اللحم/الستربس الأساسية فقط تلقائياً. 
                              هنا بنهاية الشهر تُسجل الكميات المتبقية فعلياً في المطبخ من الخامات المكملة (العيش، الخضار، التوابل، الصوصات) لاحتساب المستهلك الحقيقي، خصمه بضغطة زر بنظام FIFO، وإظهار الأرباح الصافية الدقيقة للمطبخ.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
                          <button
                            type="button"
                            onClick={handleExportToExcel}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer border border-emerald-400/40"
                            title="تصدير كشف جرد المطبخ وأرباح السندوتشات إلى إكسيل"
                          >
                            <Download size={16} />
                            <span>تصدير إكسيل 📊</span>
                          </button>
                          <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs rounded-xl border border-white/20 flex items-center gap-2 transition-all cursor-pointer"
                          >
                            <Printer size={16} />
                            <span>طباعة كشف الجرد</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => generateReportForDates('KITCHEN_CLOSING', startDate, endDate)}
                            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-black text-xs rounded-xl border border-white/20 flex items-center gap-2 transition-all cursor-pointer"
                          >
                            <RefreshCw size={16} />
                            <span>تحديث 🔄</span>
                          </button>
                          {detailedData.isClosed && !isKitchenEditMode && isAdmin && (
                            <button
                              type="button"
                              onClick={() => setShowEditConfirmModal(true)}
                              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-gray-950 font-black text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                              <Edit3 size={15} />
                              <span>تعديل التقفيلة ✏️</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Edit Mode Banner when Reopened */}
                    {detailedData.isClosed && isKitchenEditMode && (
                      <div className="bg-gradient-to-r from-amber-900/60 to-orange-950/60 border-2 border-amber-500/60 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-white">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-amber-500 text-gray-950 rounded-xl">
                            <Edit3 size={18} />
                          </div>
                          <div>
                            <div className="font-black text-amber-300 text-sm">أنت الآن في وضع تعديل تقفيلة معتمدة لشهر {detailedData.monthKey}</div>
                            <div className="text-xs text-gray-300 font-bold mt-0.5">تم الاحتفاظ بالأرقام المسجلة مسبقاً لتعديل ما يلزم فقط دون البدء من جديد.</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsKitchenEditMode(false);
                            const approvedCounts = {};
                            (detailedData.materials || []).forEach(m => {
                              approvedCounts[m.id] = m.actualRemaining !== undefined ? m.actualRemaining : m.currentStock;
                            });
                            setKitchenActualCounts(approvedCounts);
                            toast('تم إلغاء التعديل والعودة للتقفيلة المعتمدة', { icon: '↩️' });
                          }}
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs rounded-xl border border-white/20 transition-all cursor-pointer self-stretch sm:self-auto text-center"
                        >
                          إلغاء التعديل والعودة ↩️
                        </button>
                      </div>
                    )}

                    {/* 2. Key Metrics & Live Recalculating Financial Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {/* Metric 1: Sandwich Sales */}
                      <div className="p-4 bg-sky-50 rounded-2xl border-2 border-sky-200 text-center shadow-sm">
                        <div className="text-[11px] font-bold text-sky-800 mb-1 flex items-center justify-center gap-1">
                          <UtensilsCrossed size={14} className="text-sky-600" />
                          <span>مبيعات السندوتشات</span>
                        </div>
                        <div className="text-2xl font-black text-sky-950">{totalRev.toFixed(2)} ج.م</div>
                        <div className="text-[11px] text-sky-700 font-bold mt-1">
                          {detailedData.summary.totalSandwichesSold} سندوتش مباع
                        </div>
                      </div>

                      {/* Metric 2: Base Meat/Chicken Cost */}
                      <div className="p-4 bg-gray-50 rounded-2xl border-2 border-gray-200 text-center shadow-sm">
                        <div className="text-[11px] font-bold text-gray-600 mb-1 flex items-center justify-center gap-1">
                          <Package size={14} className="text-gray-500" />
                          <span>تكلفة اللحوم والدجاج</span>
                        </div>
                        <div className="text-2xl font-black text-gray-800">{totalBaseCost.toFixed(2)} ج.م</div>
                        <div className="text-[10px] text-gray-500 font-bold mt-1">
                          مخصومة مسبقاً مع كل سندوتش
                        </div>
                      </div>

                      {/* Metric 3: Month Purchases Cost */}
                      <div className="p-4 bg-purple-50 rounded-2xl border-2 border-purple-200 text-center shadow-sm">
                        <div className="text-[11px] font-bold text-purple-800 mb-1 flex items-center justify-center gap-1">
                          <ShoppingCart size={14} className="text-purple-600" />
                          <span>وارد مشتريات الشهر</span>
                        </div>
                        <div className="text-2xl font-black text-purple-950">{Number(detailedData.summary.totalPeriodPurchasesCost || 0).toFixed(2)} ج.م</div>
                        <div className="text-[10px] text-purple-700 font-bold mt-1">
                          فواتير الموردين لخامات المطبخ
                        </div>
                      </div>

                      {/* Metric 4: Auxiliary Consumed Cost (LIVE) */}
                      <div className="p-4 bg-amber-50 rounded-2xl border-2 border-amber-300 text-center shadow-sm relative overflow-hidden">
                        <div className="text-[11px] font-bold text-amber-900 mb-1 flex items-center justify-center gap-1">
                          <Sparkles size={14} className="text-amber-600" />
                          <span>تكلفة الخامات المستهلكة ⚡</span>
                        </div>
                        <div className="text-2xl font-black text-amber-950">{netConsumedAuxCost.toFixed(2)} ج.م</div>
                        <div className="text-[10px] text-amber-800 font-bold mt-1">
                          {detailedData.summary.totalAuxConsumedCostSettledSoFar > 0
                            ? `(سابقاً: ${detailedData.summary.totalAuxConsumedCostSettledSoFar} ج.م)`
                            : 'محسوبة حياً من الجرد الفعلي'}
                        </div>
                      </div>

                      {/* Metric 5: Live Actual Net Profit */}
                      <div className={`p-4 rounded-2xl border-2 text-center col-span-2 md:col-span-1 shadow-sm transition-all ${
                        isProfitable ? 'bg-emerald-50 border-emerald-300' : 'bg-rose-50 border-rose-300'
                      }`}>
                        <div className={`text-[11px] font-black mb-1 flex items-center justify-center gap-1 ${
                          isProfitable ? 'text-emerald-800' : 'text-rose-800'
                        }`}>
                          <span>الربح الفعلي لمطبخ السندوتشات</span>
                        </div>
                        <div className={`text-2xl font-black ${
                          isProfitable ? 'text-emerald-700' : 'text-rose-600'
                        }`}>
                          {liveNetProfit.toFixed(2)} ج.م
                        </div>
                        <div className={`text-[11px] font-black mt-1 ${
                          isProfitable ? 'text-emerald-600' : 'text-rose-500'
                        }`}>
                          هامش الربح: {liveMargin}%
                        </div>
                      </div>
                    </div>

                    {/* 3. Filters & Quick Fill Tools Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-3">
                      {/* Toggle View Mode */}
                      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto">
                        <button
                          type="button"
                          onClick={() => setKitchenFilterMode('AUXILIARY_ONLY')}
                          className={`flex-1 md:flex-initial px-4 py-2 rounded-lg font-black text-xs transition-all cursor-pointer ${
                            kitchenFilterMode === 'AUXILIARY_ONLY'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          🥗 الخامات المكملة فقط ({detailedData.auxiliaryMaterials?.length || 0}) — مطلوب جردها
                        </button>
                        <button
                          type="button"
                          onClick={() => setKitchenFilterMode('ALL')}
                          className={`flex-1 md:flex-initial px-4 py-2 rounded-lg font-black text-xs transition-all cursor-pointer ${
                            kitchenFilterMode === 'ALL'
                              ? 'bg-gray-800 text-white shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          📦 كل خامات المطبخ ({detailedData.materials?.length || 0})
                        </button>
                      </div>

                      {/* Quick Fill Helpers */}
                      {detailedData.isClosed && !isKitchenEditMode ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-xl border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                            <Lock size={13} />
                            <span>الأرصدة معتمدة ومقفولة رسمياً — للعرض فقط</span>
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2 justify-end w-full md:w-auto">
                          <span className="text-xs text-gray-500 font-bold hidden lg:inline">إجراءات تعبئة سريعة:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const resetCounts = {};
                              (detailedData.materials || []).forEach(m => {
                                resetCounts[m.id] = m.currentStock;
                              });
                              setKitchenActualCounts(resetCounts);
                              toast.success('تمت مطابقة الكل مع رصيد النظام (استهلاك = 0)');
                            }}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-700 font-bold text-xs rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <RotateCcw size={14} />
                            <span>مطابقة الكل مع النظام</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const theoreticalCounts = {};
                              (detailedData.materials || []).forEach(m => {
                                theoreticalCounts[m.id] = Math.max(0, Number((m.currentStock - m.theoreticalUsage).toFixed(3)));
                              });
                              setKitchenActualCounts(theoreticalCounts);
                              toast.success('تم تطبيق كميات الاستهلاك النظري للسندوتشات المباعة');
                            }}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-800 font-bold text-xs rounded-xl border border-amber-200 flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Calculator size={14} />
                            <span>تطبيق الاستهلاك النظري ⚡</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const zeroCounts = {};
                              (detailedData.materials || []).forEach(m => {
                                zeroCounts[m.id] = 0;
                              });
                              setKitchenActualCounts(zeroCounts);
                              toast('تم تصفير المتبقي (استهلاك كامل الكمية)', { icon: '⚠️' });
                            }}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <span>تصفير المتبقي (0)</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 4. Interactive Inventory Count Table */}
                    <div className="bg-white rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden">
                      <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Layers size={18} className="text-emerald-700" />
                          <h3 className="font-black text-gray-900 text-sm">
                            جدول جرد وتسوية الخامات المكملة لشهر {formatDate(startDate)} إلى {formatDate(endDate)}
                          </h3>
                        </div>
                        <span className="text-xs text-gray-500 font-bold">
                          عدد الأصناف المعروضة: <strong className="text-emerald-700 font-mono">{displayedMaterials.length}</strong>
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-gray-100/80 text-gray-700 font-bold border-b border-gray-200">
                            <tr>
                              <th className="p-3 w-10 text-center">#</th>
                              <th className="p-3">اسم الخامة / الصنف</th>
                              <th className="p-3">الوحدة</th>
                              <th className="p-3">سعر الشراء (ج.م)</th>
                              <th className="p-3">وارد المشتريات</th>
                              <th className="p-3 bg-gray-200/50">رصيد النظام حالياً</th>
                              <th className="p-3 bg-emerald-100/60 text-emerald-950 font-black min-w-[170px]">
                                المتبقي الفعلي بالمطبخ الآن ✍️
                              </th>
                              <th className="p-3">الاستهلاك الفعلي</th>
                              <th className="p-3">تكلفة الاستهلاك (ج.م)</th>
                              <th className="p-3">الاستهلاك النظري (دليل)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-bold">
                            {displayedMaterials.map((m, idx) => {
                              const actualVal = kitchenActualCounts[m.id] !== undefined 
                                ? kitchenActualCounts[m.id] 
                                : m.currentStock;
                              const actualNum = Number(actualVal || 0);
                              const diff = Number((m.currentStock - actualNum).toFixed(3)); // > 0 consumed, < 0 surplus
                              const cost = Number((diff * m.unitCost).toFixed(2));

                              return (
                                <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                                  <td className="p-3 text-center text-gray-400 font-mono">{idx + 1}</td>
                                  <td className="p-3">
                                    <div className="font-black text-gray-900 text-sm">{m.name}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] text-gray-400 font-mono">{m.code}</span>
                                      {m.isBase ? (
                                        <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-black">
                                          مكون أساسي (لحوم)
                                        </span>
                                      ) : (
                                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-black">
                                          خامة مكملة (تسوية)
                                        </span>
                                      )}
                                      {m.usedInSandwiches?.length > 0 && (
                                        <span className="text-[9px] text-gray-500 font-normal">
                                          مستخدم في: {m.usedInSandwiches.join('، ')}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-3 text-gray-600 font-mono">{m.unit}</td>
                                  <td className="p-3 font-mono font-black text-gray-900">{m.unitCost.toFixed(2)}</td>
                                  <td className="p-3 font-mono">
                                    {m.purchasedQty > 0 ? (
                                      <div>
                                        <div className="text-gray-900 font-black">+{m.purchasedQty} {m.unit}</div>
                                        <div className="text-[10px] text-purple-700">({m.purchasedCost} ج.م)</div>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400 font-normal">لا مشتريات</span>
                                    )}
                                  </td>
                                  <td className="p-3 bg-gray-100/50 font-mono text-sm font-black text-gray-800">
                                    {m.currentStock} {m.unit}
                                  </td>

                                  {/* Actual Physical Count Editable Input */}
                                  <td className="p-3 bg-emerald-50/40">
                                    {detailedData.isClosed && !isKitchenEditMode ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-mono font-black text-sm text-emerald-950 bg-emerald-100/90 px-3 py-1.5 rounded-xl border border-emerald-300 inline-block shadow-xs">
                                          {actualVal} {m.unit}
                                        </span>
                                        <span className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                          معتمد
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="relative flex items-center gap-1.5">
                                        <input
                                          type="number"
                                          step="any"
                                          min="0"
                                          value={actualVal}
                                          onChange={(e) => {
                                            const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                            setKitchenActualCounts(prev => ({
                                              ...prev,
                                              [m.id]: val
                                            }));
                                          }}
                                          className="w-28 p-2 border-2 border-emerald-400 rounded-xl font-mono font-black text-sm text-center text-emerald-950 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 outline-none shadow-sm"
                                          placeholder="0"
                                        />
                                        <span className="text-xs font-bold text-gray-500 font-mono">{m.unit}</span>
                                      </div>
                                    )}
                                  </td>

                                  {/* Consumed Quantity with Difference Tag */}
                                  <td className="p-3 font-mono text-sm">
                                    {diff > 0 ? (
                                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-1 rounded-lg font-black">
                                        <span>-{diff}</span>
                                        <span className="text-[10px] font-sans font-bold">مستهلك</span>
                                      </span>
                                    ) : diff < 0 ? (
                                      <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-900 px-2 py-1 rounded-lg font-black">
                                        <span>+{Math.abs(diff)}</span>
                                        <span className="text-[10px] font-sans font-bold">فائض</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-2 py-1 rounded-lg font-bold text-xs">
                                        <Check size={13} className="text-emerald-600" />
                                        <span>مطابق</span>
                                      </span>
                                    )}
                                  </td>

                                  {/* Consumed Cost */}
                                  <td className="p-3 font-mono font-black">
                                    {diff > 0 ? (
                                      <span className="text-amber-900 font-black">{cost.toFixed(2)} ج.م</span>
                                    ) : diff < 0 ? (
                                      <span className="text-blue-700 font-bold">{cost.toFixed(2)} ج.م (فائض)</span>
                                    ) : (
                                      <span className="text-gray-400 font-normal">0.00 ج.م</span>
                                    )}
                                  </td>

                                  {/* Theoretical usage guidance */}
                                  <td className="p-3 text-gray-500 text-[11px] font-mono">
                                    {m.theoreticalUsage > 0 ? (
                                      <div>
                                        <span className="text-gray-800 font-bold">{m.theoreticalUsage} {m.unit}</span>
                                        <span className="text-gray-400 block text-[10px]">({m.theoreticalCost} ج.م)</span>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}

                            {displayedMaterials.length === 0 && (
                              <tr>
                                <td colSpan="10" className="p-8 text-center text-gray-400 font-bold">
                                  لا توجد خامات مطبخ مسجلة حالياً
                                </td>
                              </tr>
                            )}
                          </tbody>
                          {displayedMaterials.length > 0 && (
                            <tfoot className="bg-gray-100 font-black text-gray-900 border-t-2 border-gray-200">
                              <tr>
                                <td colSpan="4" className="p-3 text-gray-800 font-black text-sm">
                                  إجمالي الجرد ({displayedMaterials.length} خامة)
                                </td>
                                <td className="p-3 font-mono text-purple-900">
                                  {displayedMaterials.reduce((sum, m) => sum + Number(m.purchasedCost || 0), 0).toFixed(2)} ج.م
                                </td>
                                <td className="p-3 font-mono text-gray-700">—</td>
                                <td className="p-3 font-mono text-emerald-900">—</td>
                                <td className="p-3 font-mono text-gray-800">—</td>
                                <td className="p-3 font-mono text-amber-900 text-sm font-black">
                                  {netConsumedAuxCost.toFixed(2)} ج.م
                                </td>
                                <td className="p-3 font-mono text-gray-600">
                                  {displayedMaterials.reduce((sum, m) => sum + Number(m.theoreticalCost || 0), 0).toFixed(2)} ج.م
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </div>

                    {/* 5. Sticky Action Bar to Commit Settlement */}
                    <div className="bg-gradient-to-r from-gray-900 to-indigo-950 p-5 rounded-2xl text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 border border-indigo-800/40">
                      <div className="space-y-1 text-center md:text-right">
                        <div className="text-xs font-bold text-gray-300 flex items-center gap-2 justify-center md:justify-start">
                          <ChefHat size={16} className="text-emerald-400" />
                          <span>ملخص اعتماد تقفيلة المطبخ الشهرية:</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold pt-1">
                          <span>
                            إجمالي خامات مستهلكة: <strong className="text-amber-400 font-mono text-sm">{netConsumedAuxCost.toFixed(2)} ج.م</strong>
                          </span>
                          <span>|</span>
                          <span>
                            تكلفة اللحوم: <strong className="text-gray-300 font-mono">{totalBaseCost.toFixed(2)} ج.م</strong>
                          </span>
                          <span>|</span>
                          <span>
                            صافي أرباح السندوتشات النهائي: <strong className="text-emerald-400 font-mono text-base font-black">+{liveNetProfit.toFixed(2)} ج.م</strong> ({liveMargin}%)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto">
                        {detailedData.isClosed && !isKitchenEditMode ? (
                          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => handleReportTypeChange('MONTHLY_FINANCIAL')}
                              className="w-full sm:w-auto px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                              <FileText size={16} />
                              <span>الانتقال للتقرير المالي الشهري (تقفيلة الشهر) 📊</span>
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setShowEditConfirmModal(true)}
                                className="w-full sm:w-auto px-5 py-3.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-gray-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                              >
                                <Edit3 size={16} />
                                <span>تعديل التقفيلة المعتمدة ✏️</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                            {detailedData.isClosed && (
                              <button
                                type="button"
                                onClick={() => {
                                  setIsKitchenEditMode(false);
                                  const approvedCounts = {};
                                  (detailedData.materials || []).forEach(m => {
                                    approvedCounts[m.id] = m.actualRemaining !== undefined ? m.actualRemaining : m.currentStock;
                                  });
                                  setKitchenActualCounts(approvedCounts);
                                }}
                                className="w-full sm:w-auto px-5 py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold text-xs rounded-xl border border-gray-700 transition-all cursor-pointer"
                              >
                                إلغاء التعديل ↩️
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowConfirmModal(true)}
                              disabled={isSubmittingSettlement}
                              className="w-full sm:w-auto px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 disabled:bg-gray-600 text-gray-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                            >
                              <CheckCircle2 size={18} className="text-emerald-950" />
                              <span>{detailedData.isClosed ? 'حفظ واعتماد التعديل في تقفيلة الشهر 💾' : 'اعتماد تقفيلة المطبخ وتسوية المخزن بالرصيد الفعلي 💾'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 6. Edit Confirmation Modal */}
                    {showEditConfirmModal && (
                      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                            <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                              <AlertTriangle size={24} />
                            </div>
                            <div>
                              <h3 className="text-base font-black text-gray-900">فتح تعديل تقفيلة المطبخ المعتمدة</h3>
                              <p className="text-xs text-gray-500 font-bold">شهر {detailedData.monthKey || ''}</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-600 font-bold leading-relaxed bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
                            هل أنت متأكد من فتح تعديل تقفيلة المطبخ المعتمدة؟
                            <br/><br/>
                            💡 <strong className="text-amber-900">ملاحظة هامة:</strong> سيتم فتح الحقول بنفس الأرقام المسجلة مسبقاً لتعديل ما تريده فقط دون الحاجة لإعادة كتابة كل شيء من جديد.
                          </p>
                          <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowEditConfirmModal(false)}
                              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowEditConfirmModal(false);
                                setIsKitchenEditMode(true);
                                toast.success('تم فتح وضع التعديل مع الاحتفاظ بالأرقام المسجلة');
                              }}
                              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-black text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit3 size={15} />
                              <span>تأكيد وفتح التعديل</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 7. Commitment Confirmation Modal */}
                    {showConfirmModal && (
                      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
                          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                            <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                              <AlertTriangle size={24} />
                            </div>
                            <div>
                              <h3 className="text-lg font-black text-gray-900">تأكيد اعتماد تقفيلة وجرد المطبخ</h3>
                              <p className="text-xs text-gray-500 font-bold">تسوية أرصدة الخامات المكملة واعتماد صافي أرباح الشهر</p>
                            </div>
                          </div>

                          <div className="space-y-3 bg-gray-50 p-4 rounded-2xl text-xs font-bold border border-gray-200">
                            <div className="flex justify-between items-center text-gray-700">
                              <span>الفترة:</span>
                              <span className="font-mono font-black text-gray-900">{formatDate(startDate)} إلى {formatDate(endDate)}</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-700">
                              <span>إجمالي مبيعات السندوتشات:</span>
                              <span className="font-mono font-black text-sky-800">{totalRev.toFixed(2)} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center text-gray-700">
                              <span>تكلفة المادة الأساسية (اللحوم):</span>
                              <span className="font-mono font-black text-gray-800">{totalBaseCost.toFixed(2)} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center text-amber-900 pt-1 border-t border-gray-200">
                              <span>تكلفة الخامات المكملة المستهلكة بالجرد:</span>
                              <span className="font-mono font-black text-sm text-amber-700">{netConsumedAuxCost.toFixed(2)} ج.م</span>
                            </div>
                            <div className="flex justify-between items-center text-emerald-950 pt-1 border-t border-gray-200 text-sm">
                              <span>صافي الربح الفعلي المعتمد للمطبخ:</span>
                              <span className="font-mono font-black text-base text-emerald-700">+{liveNetProfit.toFixed(2)} ج.م</span>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">ملاحظات التقفيل (اختياري):</label>
                            <input
                              type="text"
                              value={kitchenNotes}
                              onChange={(e) => setKitchenNotes(e.target.value)}
                              placeholder="مثال: تقفيلة وجرد مطبخ الكانتين لشهر أكتوبر"
                              className="w-full p-3 border-2 border-gray-200 rounded-xl font-bold text-xs text-gray-800 focus:border-emerald-600 outline-none"
                            />
                          </div>

                          <p className="text-[11px] text-gray-500 font-bold bg-amber-50 p-3 rounded-xl border border-amber-100 leading-relaxed">
                            ⚠️ عند الضغط على تأكيد: سيتم خصم كميات الخامات المستهلكة من دفعات المخزن بنظام FIFO وتعيين الأرصدة الجديدة كأرصدة بداية للشهر القادم، وتثبيت التكلفة في تقفيلة الشهر.
                          </p>

                          <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => setShowConfirmModal(false)}
                              disabled={isSubmittingSettlement}
                              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs rounded-xl transition-all cursor-pointer"
                            >
                              إلغاء وتعديل الأرقام
                            </button>
                            <button
                              type="button"
                              onClick={handleCommitKitchenSettlement}
                              disabled={isSubmittingSettlement}
                              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                            >
                              {isSubmittingSettlement ? (
                                <span>جاري الاعتماد والتسوية...</span>
                              ) : (
                                <>
                                  <CheckCircle2 size={16} />
                                  <span>{detailedData?.isClosed ? 'تأكيد وحفظ التعديل 💾' : 'تأكيد التسوية والاعتماد 💾'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ================= VIEW 3: SHIFTS REPORT ================= */}
              {reportType === 'SHIFTS' && detailedData?.reportType === 'SHIFTS' && Array.isArray(detailedData.data) && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                      <div className="text-xs text-gray-500 font-bold mb-1">إجمالي عدد الورديات</div>
                      <div className="text-2xl font-black text-indigo-700">{detailedData.summary?.shiftsCount ?? detailedData.data.length}</div>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                      <div className="text-xs text-gray-500 font-bold mb-1">إجمالي النقدية الموردة للخزينة</div>
                      <div className="text-2xl font-black text-emerald-700">{Number(detailedData.summary?.totalTransferred || 0).toFixed(2)} ج.م</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                      <div className="text-xs text-gray-500 font-bold mb-1">إجمالي عهد البداية</div>
                      <div className="text-2xl font-black text-gray-800">{Number(detailedData.summary?.totalStarting || 0).toFixed(2)} ج.م</div>
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
                            <td className="p-3">{s.openedBy || '-'}</td>
                            <td className="p-3 font-mono" dir="ltr">{formatDateTime(s.openedAt)}</td>
                            <td className="p-3">{s.closedBy || '-'}</td>
                            <td className="p-3 font-mono" dir="ltr">{s.closedAt ? formatDateTime(s.closedAt) : '-'}</td>
                            <td className="p-3">{Number(s.startingCash || 0).toFixed(2)} ج</td>
                            <td className="p-3">{s.systemBalance !== null && s.systemBalance !== '-' ? `${Number(s.systemBalance).toFixed(2)} ج` : '-'}</td>
                            <td className="p-3">{s.actualBalance !== null && s.actualBalance !== '-' ? `${Number(s.actualBalance).toFixed(2)} ج` : '-'}</td>
                            <td className={`p-3 ${s.discrepancy?.includes?.('عجز') ? 'text-red-600' : s.discrepancy?.includes?.('زيادة') ? 'text-green-600' : 'text-gray-600'}`}>
                              {s.discrepancy || 'مطابق للنظام'}
                            </td>
                            <td className="p-3 text-indigo-700">{Number(s.transferredCash || 0).toFixed(2)} ج</td>
                            <td className="p-3 text-emerald-700">{Number(s.remainingCash || 0).toFixed(2)} ج</td>
                          </tr>
                        ))}
                        {detailedData.data.length === 0 && (
                          <tr>
                            <td colSpan="12" className="p-8 text-center text-gray-400 font-bold">
                              لا توجد ورديات مسجلة في هذه الفترة
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ================= VIEW 4: SUPPLIERS DEBTS REPORT ================= */}
              {reportType === 'SUPPLIERS' && detailedData?.reportType === 'SUPPLIERS' && Array.isArray(detailedData.data) && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                      <div className="text-xs text-gray-500 font-bold mb-1">إجمالي الموردين</div>
                      <div className="text-2xl font-black text-indigo-700">{detailedData.summary?.totalSuppliers ?? detailedData.data.length}</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-center">
                      <div className="text-xs text-gray-500 font-bold mb-1">إجمالي المشتريات التاريخية</div>
                      <div className="text-2xl font-black text-gray-800">{Number(detailedData.summary?.totalPurchases || 0).toFixed(2)} ج.م</div>
                    </div>
                    <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-200 text-center">
                      <div className="text-xs font-black text-red-700 mb-1">إجمالي ديون الموردين (علينا)</div>
                      <div className="text-2xl font-black text-red-600">{Number(detailedData.summary?.totalDebt || 0).toFixed(2)} ج.م</div>
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
                            <td className="p-3 font-mono">{s.phone || '-'}</td>
                            <td className="p-3">{s.purchasesCount ?? 0}</td>
                            <td className="p-3 text-gray-700">{Number(s.totalPurchases || 0).toFixed(2)} ج.م</td>
                            <td className="p-3 text-emerald-700">{Number(s.totalPaid || 0).toFixed(2)} ج.م</td>
                            <td className="p-3 text-red-600 font-black text-sm">{Number(s.currentDebt || 0).toFixed(2)} ج.م</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] ${(s.currentDebt || 0) > 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {s.status || ((s.currentDebt || 0) > 0 ? 'مستحق له مديونية' : 'خالص الحساب')}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {detailedData.data.length === 0 && (
                          <tr>
                            <td colSpan="7" className="p-8 text-center text-gray-400 font-bold">
                              لا يوجد موردين مسجلين حالياً
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ================= VIEW 5: GENERAL REPORTS (SALES, PURCHASES, EXPENSES, INVENTORY, LOW_STOCK, PATIENTS) ================= */}
              {!['DAILY_FINANCIAL', 'MONTHLY_FINANCIAL', 'KITCHEN_CLOSING', 'SHIFTS', 'SUPPLIERS'].includes(reportType) && detailedData?.reportType === reportType && Array.isArray(detailedData.data) && (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  {detailedData.summary && (
                    <>
                      {reportType === 'EXPENSES' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                          {/* 1. Main Filtered Total Card */}
                          <div className="bg-red-50 p-5 rounded-2xl border-2 border-red-200 text-center shadow-sm">
                            <p className="text-red-700 font-bold mb-1 text-xs">
                              {selectedExpenseCategory !== 'ALL' && selectedCatObj 
                                ? `إجمالي منصرف (${selectedCatObj.name})`
                                : selectedPaymentMethod !== 'ALL' && selectedPaymentMethodObj
                                ? `إجمالي منصرف من (${selectedPaymentMethodObj.name})`
                                : 'إجمالي المصروفات المنصرفة'}
                            </p>
                            <p className="text-2xl font-black text-red-600">
                              {Number(detailedData.summary.totalExpenses || 0).toFixed(2)} ج.م
                            </p>
                            <p className="text-[11px] text-gray-500 font-bold mt-1">
                              {detailedData.summary.expenseCount || 0} عملية صرف مسجلة
                            </p>
                          </div>

                          {/* 2. When a specific category is selected -> Show Breakdown by Payment Channel */}
                          {selectedExpenseCategory !== 'ALL' ? (
                            <>
                              {detailedData.summary.activePaymentMethods && detailedData.summary.activePaymentMethods.map((pm, idx) => (
                                <div key={idx} className="bg-emerald-50 p-5 rounded-2xl border-2 border-emerald-200 text-center shadow-sm">
                                  <p className="text-emerald-800 font-bold mb-1 text-xs">صُرف من ({pm.name})</p>
                                  <p className="text-xl font-black text-emerald-900">{pm.amount.toFixed(2)} ج.م</p>
                                  <p className="text-[11px] text-emerald-700 font-bold mt-1">
                                    نسبة {pm.percentage}% من إجمالي البند
                                  </p>
                                </div>
                              ))}
                              {(!detailedData.summary.activePaymentMethods || detailedData.summary.activePaymentMethods.length === 0) && (
                                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 text-center shadow-sm">
                                  <p className="text-gray-500 font-bold mb-1 text-xs">حالة البند</p>
                                  <p className="text-base font-black text-gray-700">لا توجد مسحوبات</p>
                                  <p className="text-[11px] text-gray-400 font-bold mt-1">0.00 ج.م خلال هذه الفترة</p>
                                </div>
                              )}
                            </>
                          ) : (
                            /* 3. When 'ALL' or a specific payment method is selected -> Show only active categories with amount > 0 */
                            <>
                              {detailedData.summary.activeCategories && detailedData.summary.activeCategories.map((cat, idx) => {
                                const isHospital = cat.name.includes('مستشفى');
                                const isSupplier = cat.name.includes('مورد');
                                const isPatient = cat.name.includes('أمانات') || cat.name.includes('مريض');
                                
                                const cardDesc = isHospital 
                                  ? 'صرفيات ومسحوبات المستشفى' 
                                  : isSupplier 
                                  ? 'سداد مديونيات وفواتير' 
                                  : isPatient 
                                  ? 'ودائع مستردة وتصفية' 
                                  : 'نثريات ومصروفات تشغيل';

                                return (
                                  <div 
                                    key={idx} 
                                    className={`p-5 rounded-2xl border-2 text-center shadow-sm ${
                                      isHospital ? 'bg-amber-50 border-amber-200' :
                                      isSupplier ? 'bg-blue-50 border-blue-200' :
                                      isPatient ? 'bg-indigo-50 border-indigo-200' :
                                      'bg-purple-50 border-purple-200'
                                    }`}
                                  >
                                    <p className={`font-bold mb-1 text-xs ${
                                      isHospital ? 'text-amber-800' :
                                      isSupplier ? 'text-blue-800' :
                                      isPatient ? 'text-indigo-800' :
                                      'text-purple-800'
                                    }`}>
                                      {cat.name}
                                    </p>
                                    <p className={`text-xl font-black ${
                                      isHospital ? 'text-amber-900' :
                                      isSupplier ? 'text-blue-900' :
                                      isPatient ? 'text-indigo-900' :
                                      'text-purple-900'
                                    }`}>
                                      {cat.amount.toFixed(2)} ج.م
                                    </p>
                                    <p className={`text-[11px] font-bold mt-1 ${
                                      isHospital ? 'text-amber-700' :
                                      isSupplier ? 'text-blue-700' :
                                      isPatient ? 'text-indigo-700' :
                                      'text-purple-700'
                                    }`}>
                                      {cardDesc} ({cat.percentage}%)
                                    </p>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      ) : (
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
                                {key === 'totalRawValueConsumed' && 'إجمالي قيمة المواد الخام المستهلكة'}
                                {key === 'totalMaterialsCount' && 'عدد خامات المطبخ والبوفيه'}
                              </p>
                              <p className="text-xl font-black text-indigo-700">
                                {typeof val === 'number' && !['invoiceCount', 'purchaseCount', 'productCount', 'expenseCount', 'totalItems', 'uniqueProducts', 'lowStockCount', 'totalPatients', 'activePatients', 'totalMaterialsCount'].includes(key)
                                  ? `${Number(val || 0).toFixed(2)} ج.م` 
                                  : val}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
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
                              <th className="p-3">التاريخ والوقت</th>
                              <th className="p-3">المورد</th>
                              <th className="p-3 w-1/4">الأصناف</th>
                              <th className="p-3">الإجمالي</th>
                              <th className="p-3">المدفوع</th>
                              <th className="p-3">المتبقي</th>
                              <th className="p-3">الحالة</th>
                              <th className="p-3">معاينة</th>
                            </>
                          )}
                          {reportType === 'EXPENSES' && (
                            <>
                              <th className="p-3">التاريخ والوقت</th>
                              <th className="p-3">نوع المصروف (إلى)</th>
                              <th className="p-3 w-1/3">البيان والتفاصيل</th>
                              <th className="p-3">من (القناة المالية)</th>
                              <th className="p-3">المسؤول</th>
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
                          {reportType === 'RAW_MATERIALS' && (
                            <>
                              <th className="p-3">المادة الخام والكود</th>
                              <th className="p-3">سعر التكلفة للوحدة</th>
                              <th className="p-3">الرصيد المتبقي بالمخزن</th>
                              <th className="p-3">المستهلك المباشر (بالبيع)</th>
                              <th className="p-3">الاستهلاك التقديري (للسندوتشات)</th>
                              <th className="p-3">إجمالي قيمة المستهلك</th>
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
                                <td className="p-3 text-indigo-600">{row.quantity ?? 0}</td>
                                <td className="p-3 text-gray-600">{Number(row.cost || 0).toFixed(2)} ج</td>
                                <td className="p-3 text-emerald-700">{Number(row.revenue || 0).toFixed(2)} ج</td>
                                <td className="p-3 text-indigo-900">{Number(row.profit || 0).toFixed(2)} ج</td>
                              </>
                            )}
                            {reportType === 'PURCHASES' && (
                              <>
                                <td className="p-3 font-mono font-black text-indigo-700">{row.id}</td>
                                <td className="p-3 font-mono" dir="ltr">{formatDateTime(row.date)}</td>
                                <td className="p-3 font-black text-gray-900">{row.supplierName || 'غير محدد'}</td>
                                <td className="p-3 text-gray-600 font-bold text-xs">{row.itemsSummary || '-'}</td>
                                <td className="p-3 text-indigo-900 font-black">{Number(row.total || 0).toFixed(2)} ج</td>
                                <td className="p-3 text-emerald-700 font-black">{Number(row.paid || 0).toFixed(2)} ج</td>
                                <td className="p-3 text-red-600 font-black">{Number(row.remaining || 0).toFixed(2)} ج</td>
                                <td className="p-3">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    row.status === 'خالصة' ? 'bg-emerald-100 text-emerald-800' : row.status === 'مدفوعة جزئياً' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {row.status}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <button 
                                    type="button"
                                    onClick={() => setInspectingInvoice(row)}
                                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs border border-indigo-200 transition-all flex items-center gap-1 shadow-sm"
                                    title="عرض تفاصيل الفاتورة"
                                  >
                                    <FileText size={14} />
                                    <span>عرض</span>
                                  </button>
                                </td>
                              </>
                            )}
                            {reportType === 'EXPENSES' && (
                              <>
                                <td className="p-3 font-mono" dir="ltr">{formatDateTime(row.date)}</td>
                                <td className="p-3">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 ${
                                    (row.category || '').includes('مستشفى') 
                                      ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                      : (row.category || '').includes('مورد') 
                                      ? 'bg-blue-100 text-blue-900 border border-blue-300' 
                                      : (row.category || '').includes('أمانات') 
                                      ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' 
                                      : 'bg-purple-100 text-purple-900 border border-purple-300'
                                  }`}>
                                    {row.category || 'عام'}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-800 font-bold">{row.description || '-'}</td>
                                <td className="p-3">
                                  <span className="font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg">
                                    {row.paymentMethod || 'نقدي (الدرج)'}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-700 font-bold">{row.user || 'النظام'}</td>
                                <td className="p-3 text-red-600 font-black text-sm">{Number(row.amount || 0).toFixed(2)} ج.م</td>
                              </>
                            )}
                            {(reportType === 'INVENTORY' || reportType === 'LOW_STOCK') && (
                              <>
                                <td className="p-3 text-gray-900 font-black">{row.name}</td>
                                <td className="p-3 text-gray-500">{row.category || row.unit || '-'}</td>
                                <td className="p-3 text-indigo-700 font-black">{row.quantity ?? 0}</td>
                                <td className="p-3 text-gray-700">{Number(row.purchasePrice || 0).toFixed(2)} ج</td>
                                <td className="p-3 text-emerald-700 font-black">{Number(row.totalValue || row.estimatedCost || 0).toFixed(2)} ج</td>
                              </>
                            )}
                            {reportType === 'PATIENTS' && (
                              <>
                                <td className="p-3 font-mono">{row.id}</td>
                                <td className="p-3 text-gray-900 font-black">{row.name}</td>
                                <td className="p-3 text-gray-500">{row.internalNumber || '-'}</td>
                                <td className="p-3">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                    (row.currentDebt || 0) < 0 ? 'bg-red-100 text-red-800' : (row.currentDebt || 0) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {row.type}
                                  </span>
                                </td>
                                <td className={`p-3 text-sm font-black ${(row.currentDebt || 0) < 0 ? 'text-red-600' : (row.currentDebt || 0) > 0 ? 'text-emerald-700' : 'text-gray-500'}`}>
                                  {Math.abs(Number(row.currentDebt || 0)).toFixed(2)} ج.م
                                </td>
                                <td className="p-3">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800">
                                    {row.status}
                                  </span>
                                </td>
                                <td className="p-3 text-gray-400 font-normal">{row.notes || '-'}</td>
                              </>
                            )}
                            {reportType === 'RAW_MATERIALS' && (
                              <>
                                <td className="p-3">
                                  <div className="font-black text-gray-900 flex items-center gap-1.5">
                                    <span>{row.name}</span>
                                    {row.isSandwichAuxiliary && (
                                      <span className="text-[9px] bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-black">
                                        مكمل للسندوتشات
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-400 font-mono">{row.code}</div>
                                </td>
                                <td className="p-3 font-mono">{Number(row.unitCost || 0).toFixed(2)} ج.م / {row.unit}</td>
                                <td className="p-3 font-mono">
                                  <span className={`px-2 py-0.5 rounded-lg text-xs font-black ${
                                    row.currentStock <= 0 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                                  }`}>
                                    {row.currentStock} {row.unit}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-purple-700 font-black">{row.consumedQty} {row.unit}</td>
                                <td className="p-3 font-mono">
                                  {row.isSandwichAuxiliary ? (
                                    <div className="space-y-0.5">
                                      <span className="text-amber-800 font-black bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-xs">
                                        ~ {row.theoreticalSandwichUsage} {row.unit}
                                      </span>
                                      <div className="text-[10px] text-gray-400 font-bold">
                                        محسوب من السندوتشات المباعة
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-gray-400 text-xs">— (خصم مباشر)</span>
                                  )}
                                </td>
                                <td className="p-3 font-mono text-red-600 font-black text-sm">
                                  {Number((row.totalCostConsumed || 0) + (row.theoreticalSandwichCost || 0)).toFixed(2)} ج.م
                                </td>
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

      {/* Purchase Invoice Inspection Modal */}
      {inspectingInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <FileText size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-800">
                    تفاصيل فاتورة شراء: <span className="font-mono text-indigo-600">{inspectingInvoice.id}</span>
                  </h3>
                  <p className="text-xs text-gray-500 font-bold mt-0.5" dir="ltr">
                    {formatDateTime(inspectingInvoice.date)}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setInspectingInvoice(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Supplier & Status Info Banner */}
            <div className="my-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs">
              <div>
                <span className="text-gray-400 block font-bold mb-1">المورد:</span>
                <span className="font-black text-gray-900 text-sm">{inspectingInvoice.supplierName}</span>
                {inspectingInvoice.supplierPhone && (
                  <span className="block text-gray-500 font-mono text-[11px]" dir="ltr">{inspectingInvoice.supplierPhone}</span>
                )}
              </div>
              <div>
                <span className="text-gray-400 block font-bold mb-1">إجمالي الفاتورة:</span>
                <span className="font-black text-indigo-700 text-sm">{Number(inspectingInvoice.total || 0).toFixed(2)} ج.م</span>
              </div>
              <div>
                <span className="text-gray-400 block font-bold mb-1">المدفوع:</span>
                <span className="font-black text-emerald-700 text-sm">{Number(inspectingInvoice.paid || 0).toFixed(2)} ج.م</span>
              </div>
              <div>
                <span className="text-gray-400 block font-bold mb-1">المتبقي / آجل:</span>
                <span className={`font-black text-sm ${Number(inspectingInvoice.remaining || 0) > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                  {Number(inspectingInvoice.remaining || 0).toFixed(2)} ج.م
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-2xl mb-4">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-50 text-gray-600 font-black text-xs sticky top-0 border-b border-gray-100">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">الصنف</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3 text-center">سعر الشراء</th>
                    <th className="p-3 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inspectingInvoice.items && inspectingInvoice.items.length > 0 ? (
                    inspectingInvoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-400 font-mono text-xs">{idx + 1}</td>
                        <td className="p-3 font-black text-gray-800">{item.productName}</td>
                        <td className="p-3 text-center font-bold text-indigo-600">{item.quantity}</td>
                        <td className="p-3 text-center font-mono">{Number(item.unitPrice || 0).toFixed(2)} ج</td>
                        <td className="p-3 text-left font-black text-gray-900 font-mono">{Number(item.subtotal || 0).toFixed(2)} ج</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-gray-400 font-bold">
                        لا توجد تفاصيل للأصناف
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {inspectingInvoice.notes && (
              <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                <span className="font-black">ملاحظات الفاتورة: </span>
                {inspectingInvoice.notes}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <span className={`px-3 py-1 rounded-full text-xs font-black ${
                inspectingInvoice.status === 'خالصة' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : inspectingInvoice.status === 'مدفوعة جزئياً' 
                  ? 'bg-amber-100 text-amber-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                حالة السداد: {inspectingInvoice.status}
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => window.print()}
                  className="bg-gray-800 hover:bg-black text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Printer size={15} />
                  <span>طباعة</span>
                </button>
                <button 
                  onClick={() => setInspectingInvoice(null)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold px-5 py-2 rounded-xl text-xs transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
