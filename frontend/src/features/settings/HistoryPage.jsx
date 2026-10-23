import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { 
  Search, Filter, X, ChevronRight, ChevronLeft, 
  Clock, ShieldAlert, FileText, CheckCircle2, User, Eye,
  ArrowUpDown, RotateCcw, SlidersHorizontal
} from 'lucide-react';

const actionMap = {
  'SALE': { label: 'فاتورة بيع (POS)', color: 'bg-emerald-100 text-[#003607] border-emerald-200' },
  'PURCHASE': { label: 'فاتورة مشتريات', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'PAY': { label: 'سداد دفعة لمورد', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  'CREATE': { label: 'إضافة جديدة', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  'TRANSFER': { label: 'تحويل سيولة بين الخزائن', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  'DAILY_SETTLEMENT': { label: 'تسوية وتقفيل يومية', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  'OPEN_SHIFT': { label: 'فتح وردية يومية', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  'CLOSE_SHIFT': { label: 'إغلاق وردية ويومية', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  'TRANSACT': { label: 'حركة رصيد مريض', color: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  'UPDATE': { label: 'تعديل بيانات', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'UPDATE_STATUS': { label: 'تحديث حالة / تصفية', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200' },
  'RETURN': { label: 'مرتجع مبيعات', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  'ADJUST_INVENTORY': { label: 'تسوية وجرد مخزون', color: 'bg-slate-100 text-slate-800 border-slate-200' },
  'RESTORE': { label: 'استعادة نسخة احتياطية', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  'DELETE': { label: 'حذف', color: 'bg-red-100 text-red-800 border-red-200' }
};

const entityMap = {
  'INVOICE': 'فواتير المبيعات (POS)',
  'EXPENSE': 'المصروفات النقدية',
  'PURCHASE': 'فواتير المشتريات',
  'SUPPLIER': 'الموردين وحساباتهم',
  'PRODUCT': 'الأصناف والمخزون',
  'PATIENT': 'ملفات المرضى والأرشيف',
  'PATIENT_TX': 'أمانات ومعاملات المرضى',
  'SHIFT': 'الورديات ونظام اليومية',
  'TREASURY': 'الخزائن والتحويلات',
  'BACKUP': 'النسخ الاحتياطي والأمان',
  'RETURN': 'مرتجعات المبيعات',
  'USER': 'المستخدمين والصلاحيات'
};

const keyTranslationMap = {
  // Sales & Invoices
  totalAmount: 'إجمالي الفاتورة',
  type: 'النوع',
  itemCount: 'عدد الأصناف',
  patientName: 'اسم المريض',
  itemNames: 'الأصناف المباعة',
  invoiceId: 'رقم الفاتورة',
  invoiceNumber: 'رقم الفاتورة',
  
  // Products & Inventory
  name: 'اسم الصنف',
  internalCode: 'الكود الداخلي',
  barcode: 'الباركود',
  sellingPrice: 'سعر البيع',
  purchasePrice: 'سعر الشراء',
  unit: 'الوحدة الأساسية',
  packageUnit: 'وحدة التعبئة الكبرى',
  piecesPerPackage: 'القطع بالعبوة',
  conversionFactor: 'معامل التحويل',
  alertThreshold: 'حد التنبيه الأدنى',
  totalStock: 'المخزون الحالي',
  quantity: 'الكمية',
  reason: 'سبب الحركة',
  
  // Treasury & Expenses
  amount: 'المبلغ',
  description: 'البيان / الوصف',
  notes: 'ملاحظات',
  categoryId: 'تصنيف المصروف',
  paymentMethodId: 'طريقة الدفع / القناة',
  paymentMethod: 'طريقة الدفع / القناة',
  fromMethodId: 'من قناة',
  toMethodId: 'إلى قناة',
  transferAmount: 'مبلغ التحويل',
  
  // Purchases & Suppliers
  supplierId: 'المورد',
  supplierName: 'اسم المورد',
  referenceNo: 'الرقم المرجعي',
  paidAmount: 'المبلغ المدفوع',
  remainingDebt: 'المتبقي كمديونية',
  
  // Shifts & Settlements
  shiftNumber: 'رقم الوردية',
  initialCash: 'عهدة بداية الوردية',
  startingCash: 'عهدة البداية',
  countedAmount: 'المبلغ المحصي بالدرج',
  actualBalance: 'الرصيد الفعلي بالدرج',
  systemBalance: 'الرصيد المتوقع بالنظام',
  discrepancy: 'الفارق (عجز / زيادة)',
  transferredAmount: 'المبلغ المورد للخزينة',
  remainingCash: 'المتبقي بالدرج لبداية اليومية',
  
  // Patients
  patientId: 'المريض',
  fullName: 'الاسم بالكامل',
  fileNumber: 'رقم الملف',
  internalNumber: 'الرقم الداخلي / الغرفة',
  phone: 'رقم الهاتف',
  nationalId: 'الرقم القومي',
  initialBalance: 'الرصيد الافتتاحي',
  currentDebt: 'الرصيد الحالي',
  source: 'المصدر',
  address: 'العنوان',
  
  // Users & System
  username: 'اسم المستخدم',
  roleId: 'الصلاحية / الدور',
  isActive: 'حالة التفعيل',
  status: 'الحالة'
};

const valueTranslationMap = {
  'CASH': 'نقدي (الدرج)',
  'CREDIT': 'على حساب المريض',
  'FULL': 'مرتجع كلي',
  'PARTIAL': 'مرتجع جزئي',
  'DEPOSIT': 'إيداع أمانات (+)',
  'WITHDRAWAL': 'سحب أمانات (-)',
  'IN': 'إضافة للمخزون (+)',
  'OUT': 'خصم من المخزون (-)',
  'OPEN': 'مفتوحة',
  'CLOSED': 'مغلقة',
  'ACTIVE': 'نشط',
  'INACTIVE': 'معطل / أرشيف',
  'DISCHARGED': 'مغادر (أرشيف)'
};

const isArabicString = (str) => /[\u0600-\u06FF]/.test(str);

const formatDetails = (newValues, isInline = false) => {
  if (!newValues) return 'لا توجد بيانات تفصيلية';
  try {
    const data = typeof newValues === 'string' ? JSON.parse(newValues) : newValues;
    const entries = Object.entries(data)
      .filter(([key]) => !['id', 'createdAt', 'updatedAt', 'password', 'passwordHash', 'items', 'returnItems', 'batches'].includes(key))
      .filter(([key]) => !isInline || !['paymentMethodId', 'patientId', 'supplierId', 'categoryId', 'roleId'].includes(key));

    const formatted = entries.map(([key, value]) => {
      // If key is already in Arabic, keep it as is; otherwise translate
      const arKey = isArabicString(key) ? key : (keyTranslationMap[key] || key);
      
      let arValue = value;
      if (typeof value === 'boolean') {
        arValue = value ? 'نعم (نشط)' : 'لا (معطل)';
      } else if (valueTranslationMap[value]) {
        arValue = valueTranslationMap[value];
      } else if (typeof value === 'object' && value !== null) {
        arValue = isInline ? '[تفاصيل]' : JSON.stringify(value);
      }

      if (isInline && (arValue === '' || arValue === null || arValue === undefined)) {
        return null;
      }

      // Add currency hint if key is money and value is a raw number
      if (typeof value === 'number' && (key.includes('Amount') || key.includes('Price') || key.includes('Cash') || key.includes('Debt'))) {
        arValue = `${value} ج.م`;
      }

      return `${arKey}: ${arValue}`;
    }).filter(Boolean);

    if (isInline) {
      return formatted.slice(0, 4).join(' | ');
    }
    return formatted.join(' | ');
  } catch (e) {
    return String(newValues);
  }
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

const HistoryPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [limit, setLimit] = useState(50);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceType, setInvoiceType] = useState(null);
  const [genericDetails, setGenericDetails] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch when page, debounced search, or filters change
  useEffect(() => {
    fetchLogs();
  }, [page, debouncedSearch, actionFilter, entityFilter, sortOrder, limit]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        sort: sortOrder
      };
      if (debouncedSearch && debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (actionFilter) params.action = actionFilter;
      if (entityFilter) params.entityType = entityFilter;

      const res = await client.get('/audit-logs', { params });
      setLogs(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalCount(res.data.pagination?.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleActionChange = (e) => {
    setActionFilter(e.target.value);
    setPage(1);
  };

  const handleEntityChange = (e) => {
    setEntityFilter(e.target.value);
    setPage(1);
  };

  const handleSortChange = (e) => {
    setSortOrder(e.target.value);
    setPage(1);
  };

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setActionFilter('');
    setEntityFilter('');
    setSortOrder('desc');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || debouncedSearch || actionFilter || entityFilter || sortOrder !== 'desc');

  const handleRowClick = async (log) => {
    if (log.entityType === 'INVOICE' && log.entityId) {
      try {
        const res = await client.get(`/sales/invoices/${log.entityId}`);
        setSelectedInvoice(res.data.data);
        setInvoiceType('INVOICE');
      } catch (err) {
        setGenericDetails(log);
      }
    } else if (log.entityType === 'PURCHASE' && log.entityId) {
      try {
        const res = await client.get(`/purchases/${log.entityId}`);
        setSelectedInvoice(res.data.data);
        setInvoiceType('PURCHASE');
      } catch (err) {
        setGenericDetails(log);
      }
    } else {
      setGenericDetails(log);
    }
  };

  const renderDetailsTable = (valuesStr) => {
    if (!valuesStr) return <div className="p-4 text-gray-400 font-bold text-center">لا توجد بيانات</div>;
    try {
      const data = typeof valuesStr === 'string' ? JSON.parse(valuesStr) : valuesStr;
      const entries = Object.entries(data).filter(([key]) => !['password', 'passwordHash'].includes(key));

      return (
        <table className="w-full text-right border-collapse text-sm">
          <tbody>
            {entries.map(([key, value]) => {
              const arKey = isArabicString(key) ? key : (keyTranslationMap[key] || key);
              let arValue = value;
              if (typeof value === 'boolean') {
                arValue = value ? 'نعم (نشط)' : 'لا (معطل)';
              } else if (valueTranslationMap[value]) {
                arValue = valueTranslationMap[value];
              } else if (typeof value === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') || key.toLowerCase().includes('balance') || key.toLowerCase().includes('cash'))) {
                arValue = `${value} ج.م`;
              }

              return (
                <tr key={key} className="border-b border-gray-100 hover:bg-gray-50/80 transition-colors">
                  <td className="p-3.5 font-bold text-gray-700 bg-gray-50/60 w-1/3 border-l border-gray-100">
                    {arKey}
                  </td>
                  <td className="p-3.5 text-gray-900 font-bold">
                    {Array.isArray(value) ? (
                      <div className="space-y-1.5 text-xs">
                        {value.map((it, idx) => (
                          <div key={idx} className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                            {typeof it === 'object' && it !== null ? (
                              Object.entries(it).map(([subK, subV]) => (
                                <span key={subK} className="ml-3">
                                  <span className="text-gray-500 font-normal">{keyTranslationMap[subK] || subK}: </span>
                                  <span className="font-bold text-gray-800">{String(subV)}</span>
                                </span>
                              ))
                            ) : (
                              <span>{String(it)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : typeof value === 'object' && value !== null ? (
                      <pre className="text-xs bg-gray-100 p-2.5 rounded-xl font-mono text-left overflow-x-auto m-0" dir="ltr">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    ) : (
                      <span>{String(arValue)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    } catch {
      return <div className="p-4 font-bold text-gray-700">{String(valuesStr)}</div>;
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls Toolbar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border-2 border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <Clock className="text-[#007507]" size={26} />
              <span>سجل حركات النظام والرقابة (Audit Log)</span>
            </h2>
            <p className="text-gray-500 mt-1 font-bold text-sm">مراقبة وتوثيق كافة العمليات النقدية والمخزنية والإدارية بالعربية بدقة وفورية</p>
          </div>

          {/* Quick Refresh and Count Indicator */}
          <div className="flex items-center gap-3">
            <span className="bg-emerald-50 text-[#007507] px-3.5 py-1.5 rounded-xl font-black text-xs border border-emerald-200">
              إجمالي الحركات: {totalCount.toLocaleString('ar-EG')}
            </span>
            <button
              onClick={fetchLogs}
              title="تحديث البيانات"
              disabled={loading}
              className="p-2.5 rounded-xl border-2 border-gray-200 hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-50"
            >
              <RotateCcw size={16} className={loading ? 'animate-spin text-[#007507]' : ''} />
            </button>
          </div>
        </div>
        
        {/* Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-gray-100">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
            <input 
              type="text" 
              placeholder="بحث في السجل والتفاصيل..." 
              className="w-full border-2 border-gray-200 rounded-xl py-2 pr-9 pl-8 outline-none focus:border-[#007507] bg-gray-50 font-bold text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Entity Filter (الأقسام) */}
          <div>
            <select 
              className="w-full border-2 border-gray-200 rounded-xl py-2 px-3 outline-none focus:border-[#007507] bg-white font-bold text-gray-700 text-xs cursor-pointer"
              value={entityFilter}
              onChange={handleEntityChange}
            >
              <option value="">كل الأقسام والسجلات</option>
              {Object.entries(entityMap).map(([key, val]) => (
                <option key={key} value={key}>{val}</option>
              ))}
            </select>
          </div>

          {/* Action Filter (أنواع الحركات) */}
          <div>
            <select 
              className="w-full border-2 border-gray-200 rounded-xl py-2 px-3 outline-none focus:border-[#007507] bg-white font-bold text-gray-700 text-xs cursor-pointer"
              value={actionFilter}
              onChange={handleActionChange}
            >
              <option value="">كل أنواع الحركات</option>
              {Object.entries(actionMap).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          {/* Sort Order Selector */}
          <div>
            <select 
              className="w-full border-2 border-gray-200 rounded-xl py-2 px-3 outline-none focus:border-[#007507] bg-white font-bold text-gray-700 text-xs cursor-pointer"
              value={sortOrder}
              onChange={handleSortChange}
            >
              <option value="desc">الترتيب: الأحدث أولاً (تنازلي) ⬇</option>
              <option value="asc">الترتيب: الأقدم أولاً (تصاعدي) ⬆</option>
            </select>
          </div>

          {/* Limit / Page Size & Reset Filter */}
          <div className="flex gap-2">
            <select 
              className="border-2 border-gray-200 rounded-xl py-2 px-2.5 outline-none focus:border-[#007507] bg-white font-bold text-gray-700 text-xs cursor-pointer flex-1"
              value={limit}
              onChange={handleLimitChange}
            >
              <option value={25}>25 بالصفحة</option>
              <option value={50}>50 بالصفحة</option>
              <option value={100}>100 بالصفحة</option>
            </select>

            {hasActiveFilters && (
              <button 
                onClick={handleResetFilters}
                title="مسح كافة الفلاتر والبحث"
                className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl font-black text-xs flex items-center gap-1 transition-colors whitespace-nowrap"
              >
                <X size={14} /> مسح
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Pills Indicator */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-xs">
            <span className="font-bold text-gray-400">الفلاتر المطبقة:</span>
            {entityFilter && (
              <span className="bg-emerald-50 text-[#003607] border border-emerald-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                القسم: {entityMap[entityFilter]}
                <button onClick={() => { setEntityFilter(''); setPage(1); }} className="hover:text-red-600">
                  <X size={12} />
                </button>
              </span>
            )}
            {actionFilter && (
              <span className="bg-emerald-50 text-[#003607] border border-emerald-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                الحركة: {actionMap[actionFilter]?.label}
                <button onClick={() => { setActionFilter(''); setPage(1); }} className="hover:text-red-600">
                  <X size={12} />
                </button>
              </span>
            )}
            {debouncedSearch && (
              <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                بحث: "{debouncedSearch}"
                <button onClick={() => { setSearch(''); setDebouncedSearch(''); setPage(1); }} className="hover:text-red-600">
                  <X size={12} />
                </button>
              </span>
            )}
            {sortOrder === 'asc' && (
              <span className="bg-gray-100 text-gray-800 border border-gray-200 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
                الترتيب: الأقدم أولاً
                <button onClick={() => { setSortOrder('desc'); setPage(1); }} className="hover:text-red-600">
                  <X size={12} />
                </button>
              </span>
            )}
            <button 
              onClick={handleResetFilters} 
              className="text-gray-400 hover:text-rose-600 font-bold underline mr-2"
            >
              مسح الكل
            </button>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden flex flex-col relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center z-10 font-black text-[#007507] text-sm gap-2">
            <RotateCcw size={18} className="animate-spin" />
            <span>جاري تحديث السجل...</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 border-b font-bold text-sm">التاريخ والوقت</th>
                <th className="p-4 border-b font-bold text-sm">المستخدم المنفذ</th>
                <th className="p-4 border-b font-bold text-sm">نوع الحركة</th>
                <th className="p-4 border-b font-bold text-sm">القسم / السجل</th>
                <th className="p-4 border-b font-bold text-sm">ملخص البيانات والتفاصيل (اضغط للعرض الكامل)</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {logs.map(log => {
                const actionInfo = actionMap[log.action] || { 
                  label: log.action, 
                  color: 'bg-gray-100 text-gray-800 border-gray-200' 
                };
                const entityName = entityMap[log.entityType] || log.entityType;
                
                return (
                  <tr 
                    key={log.id} 
                    onClick={() => handleRowClick(log)}
                    className="border-b border-gray-100 transition-colors cursor-pointer hover:bg-emerald-50/70 group"
                  >
                    <td className="p-4 text-xs font-bold text-gray-500 font-mono" dir="ltr">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="p-4 font-bold text-gray-800">
                      <div className="flex items-center gap-1.5">
                        <User size={15} className="text-gray-400" />
                        <span>{log.user?.fullName || log.user?.username || 'النظام'}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-black border ${actionInfo.color}`}>
                        {actionInfo.label}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-gray-800">
                      <span>{entityName}</span>
                      {log.entityId && (
                        <span className="text-xs text-[#007507] font-mono mr-1.5 font-bold">
                          #{log.entityId}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs font-bold text-gray-700 max-w-md truncate group-hover:text-[#003607]" title="اضغط لعرض التفاصيل الكاملة">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{formatDetails(log.newValues, true)}</span>
                        <Eye size={14} className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && logs.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-400 font-bold text-base">
                    لا توجد حركات مسجلة مطابقة لخيارات البحث أو الفلترة المحددة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="bg-gray-50 p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs font-bold text-gray-500">
            عرض {logs.length} حركة من إجمالي {totalCount.toLocaleString('ar-EG')} حركة مسجلة
          </div>

          <div className="flex items-center gap-3">
            <button 
              disabled={page <= 1 || loading} 
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              className="px-4 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-[#007507] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm flex items-center gap-1 transition-colors shadow-sm"
            >
              <ChevronRight size={18} /> السابق
            </button>
            <span className="font-black text-gray-700 text-sm px-2">
              صفحة {page} من {Math.max(totalPages, 1)}
            </span>
            <button 
              disabled={page >= totalPages || loading} 
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-[#007507] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm flex items-center gap-1 transition-colors shadow-sm"
            >
              التالي <ChevronLeft size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                <FileText className="text-[#007507]" size={26} />
                <span>{invoiceType === 'INVOICE' ? 'فاتورة مبيعات' : 'فاتورة مشتريات'} #{selectedInvoice.id}</span>
              </h3>
              <button 
                onClick={() => setSelectedInvoice(null)} 
                className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-sm">
              <div>
                <p className="text-gray-500 font-bold mb-1">المستخدم / الكاشير:</p>
                <p className="font-black text-gray-800">{selectedInvoice.user?.fullName || selectedInvoice.user?.username || 'مجهول'}</p>
              </div>
              <div>
                <p className="text-gray-500 font-bold mb-1">التاريخ والوقت:</p>
                <p className="font-bold text-gray-800 font-mono" dir="ltr">{new Date(selectedInvoice.createdAt).toLocaleString('ar-EG')}</p>
              </div>
              {invoiceType === 'INVOICE' && selectedInvoice.patient && (
                <div className="col-span-2 pt-2 border-t border-gray-200">
                  <p className="text-gray-500 font-bold mb-1">المريض (العميل):</p>
                  <p className="font-black text-[#007507]">{selectedInvoice.patient.fullName}</p>
                </div>
              )}
              {invoiceType === 'PURCHASE' && selectedInvoice.supplier && (
                <div className="col-span-2 pt-2 border-t border-gray-200">
                  <p className="text-gray-500 font-bold mb-1">المورد:</p>
                  <p className="font-black text-[#007507]">{selectedInvoice.supplier.name}</p>
                </div>
              )}
            </div>

            <h4 className="font-black text-gray-800 mb-3 text-sm">الأصناف المشمولة:</h4>
            <table className="w-full text-right mb-6 border border-gray-200 rounded-xl overflow-hidden text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-3 border-b font-bold">الصنف</th>
                  <th className="p-3 border-b font-bold">الكمية</th>
                  <th className="p-3 border-b font-bold">السعر</th>
                  <th className="p-3 border-b font-bold">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.items?.map(item => (
                  <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-3 font-bold text-gray-800">{item.product?.name || item.productName || 'صنف مسجل'}</td>
                    <td className="p-3 font-bold">{item.quantity}</td>
                    <td className="p-3 font-bold">{item.unitPrice} ج.م</td>
                    <td className="p-3 font-black text-[#007507]">{item.subtotal} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#003607] text-base">إجمالي الفاتورة:</span>
                <span className="font-black text-2xl text-[#007507]">{selectedInvoice.totalAmount} ج.م</span>
              </div>
              {invoiceType === 'PURCHASE' && selectedInvoice.paidAmount !== undefined && (
                <>
                  <div className="flex justify-between items-center border-t border-emerald-100 pt-2 text-sm">
                    <span className="font-bold text-emerald-800">المبلغ المدفوع من الخزينة:</span>
                    <span className="font-black text-emerald-600">{selectedInvoice.paidAmount} ج.م</span>
                  </div>
                  {selectedInvoice.totalAmount > selectedInvoice.paidAmount && (
                    <div className="flex justify-between items-center border-t border-emerald-100 pt-2 text-sm">
                      <span className="font-bold text-red-800">المتبقي كمديونية للمورد:</span>
                      <span className="font-black text-red-600">{(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toFixed(2)} ج.م</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generic Audit Details Modal */}
      {genericDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/80">
              <div>
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                  <Clock className="text-[#007507]" size={22} />
                  <span>تفاصيل حركة النظام</span>
                </h3>
                <p className="text-[#007507] font-bold text-sm mt-1">
                  {entityMap[genericDetails.entityType] || genericDetails.entityType} {genericDetails.entityId ? `(#${genericDetails.entityId})` : ''} — {actionMap[genericDetails.action]?.label || genericDetails.action}
                </p>
              </div>
              <button 
                onClick={() => setGenericDetails(null)} 
                className="p-2 bg-white rounded-xl shadow-sm hover:bg-gray-100 text-gray-500 transition-colors border border-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="text-xs text-gray-500 font-bold mb-1">المستخدم المنفذ</div>
                  <div className="font-black text-gray-800">{genericDetails.user?.fullName || genericDetails.user?.username || 'النظام'}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="text-xs text-gray-500 font-bold mb-1">توقيت الحركة</div>
                  <div className="font-bold text-gray-800 font-mono" dir="ltr">{new Date(genericDetails.createdAt).toLocaleString('ar-EG')}</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-black text-gray-800 mb-3 text-sm flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-600" />
                  <span>البيانات المسجلة للحركة (باللغة العربية):</span>
                </h4>
                <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  {renderDetailsTable(genericDetails.newValues)}
                </div>
              </div>

              {genericDetails.oldValues && (
                <div>
                  <h4 className="font-black text-gray-800 mb-3 text-sm flex items-center gap-1.5">
                    <Clock size={16} className="text-amber-600" />
                    <span>البيانات السابقة قبل التعديل:</span>
                  </h4>
                  <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    {renderDetailsTable(genericDetails.oldValues)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HistoryPage;
