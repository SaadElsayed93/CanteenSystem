import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { 
  Search, Filter, X, ChevronRight, ChevronLeft, 
  Clock, ShieldAlert, FileText, CheckCircle2, User, Eye
} from 'lucide-react';

const actionMap = {
  'CREATE': { label: 'إضافة جديدة', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  'UPDATE': { label: 'تعديل بيانات', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'DELETE': { label: 'حذف', color: 'bg-red-100 text-red-800 border-red-200' },
  'LOGIN': { label: 'تسجيل دخول', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  'ADJUST': { label: 'تسوية مخزون', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'ADJUST_INVENTORY': { label: 'تسوية مخزون', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'SALE': { label: 'فاتورة بيع (POS)', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'TRANSACT': { label: 'حركة رصيد مريض', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  'RETURN': { label: 'مرتجع مبيعات', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  'UPDATE_STATUS': { label: 'تحديث حالة / تصفية', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  'OPEN_SHIFT': { label: 'فتح وردية يومية', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  'CLOSE_SHIFT': { label: 'إغلاق وردية ويومية', color: 'bg-rose-100 text-rose-800 border-rose-200' },
  'PAY': { label: 'سداد دفعة لمورد', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  'TRANSFER': { label: 'تحويل بين الخزائن', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  'DAILY_SETTLEMENT': { label: 'تسوية وتقفيل يومية', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  'PURCHASE': { label: 'فاتورة مشتريات', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'DISCHARGE': { label: 'تصفية مريض وأرشيف', color: 'bg-teal-100 text-teal-800 border-teal-200' }
};

const entityMap = {
  'PRODUCT': 'الأصناف والمخزون',
  'INVOICE': 'فواتير المبيعات (POS)',
  'USER': 'المستخدمين والصلاحيات',
  'SUPPLIER': 'الموردين وحساباتهم',
  'PURCHASE': 'فواتير المشتريات',
  'PATIENT': 'ملفات المرضى والأرشيف',
  'SYSTEM': 'إعدادات النظام',
  'EXPENSE': 'المصروفات النقدية',
  'TREASURY': 'الخزائن والتحويلات',
  'CATEGORY': 'التصنيفات والأقسام',
  'SUPPLIER_PAYMENT': 'سداد ديون الموردين',
  'PATIENT_TX': 'أمانات ومعاملات المرضى',
  'RETURN': 'مرتجعات المبيعات',
  'SHIFT': 'الورديات ونظام اليومية'
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
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceType, setInvoiceType] = useState(null);
  const [genericDetails, setGenericDetails] = useState(null);

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await client.get(`/audit-logs?page=${page}&limit=50`);
      setLogs(res.data.data);
      setTotalPages(res.data.pagination?.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  const filteredLogs = logs.filter(log => {
    const userMatches = 
      (log.user?.fullName?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.user?.username?.toLowerCase() || '').includes(search.toLowerCase());
    const detailsMatch = formatDetails(log.newValues, true).toLowerCase().includes(search.toLowerCase());
    const actionLabel = actionMap[log.action]?.label?.toLowerCase() || '';
    const entityLabel = entityMap[log.entityType]?.toLowerCase() || '';

    const matchesSearch = userMatches || detailsMatch || actionLabel.includes(search.toLowerCase()) || entityLabel.includes(search.toLowerCase());
    const matchesAction = !actionFilter || log.action === actionFilter;
    const matchesEntity = !entityFilter || log.entityType === entityFilter;

    return matchesSearch && matchesAction && matchesEntity;
  });

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

  if (loading && logs.length === 0) {
    return <div className="p-8 text-center text-gray-500 font-bold">جاري تحميل سجل الحركات...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Search */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Clock className="text-indigo-600" size={26} />
            <span>سجل حركات النظام والرقابة (Audit Log)</span>
          </h2>
          <p className="text-gray-500 mt-1 font-bold text-sm">مراقبة وتوثيق كافة العمليات النقدية والمخزنية والإدارية بالعربية</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث في السجل والمستخدمين..." 
              className="w-full border-2 border-gray-200 rounded-xl py-2.5 pr-10 pl-4 outline-none focus:border-indigo-600 bg-gray-50 font-bold text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <select 
              className="border-2 border-gray-200 rounded-xl py-2.5 px-4 outline-none focus:border-indigo-600 bg-white font-bold text-gray-700 text-sm cursor-pointer"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="">كل أنواع الحركات</option>
              {Object.entries(actionMap).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div className="relative">
            <select 
              className="border-2 border-gray-200 rounded-xl py-2.5 px-4 outline-none focus:border-indigo-600 bg-white font-bold text-gray-700 text-sm cursor-pointer"
              value={entityFilter}
              onChange={e => setEntityFilter(e.target.value)}
            >
              <option value="">كل الأقسام</option>
              {Object.entries(entityMap).map(([key, val]) => (
                <option key={key} value={key}>{val}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden flex flex-col">
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
              {filteredLogs.map(log => {
                const actionInfo = actionMap[log.action] || { 
                  label: log.action, 
                  color: 'bg-gray-100 text-gray-800 border-gray-200' 
                };
                const entityName = entityMap[log.entityType] || log.entityType;
                
                return (
                  <tr 
                    key={log.id} 
                    onClick={() => handleRowClick(log)}
                    className="border-b border-gray-100 transition-colors cursor-pointer hover:bg-indigo-50/70 group"
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
                        <span className="text-xs text-indigo-600 font-mono mr-1.5 font-bold">
                          #{log.entityId}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs font-bold text-gray-700 max-w-md truncate group-hover:text-indigo-900" title="اضغط لعرض التفاصيل الكاملة">
                      <div className="flex items-center gap-2">
                        <span className="truncate">{formatDetails(log.newValues, true)}</span>
                        <Eye size={14} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-12 text-center text-gray-400 font-bold text-base">
                    لا توجد حركات مسجلة مطابقة لخيارات البحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="bg-gray-50 p-4 border-t border-gray-200 flex justify-center items-center gap-4">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm flex items-center gap-1 transition-colors"
            >
              <ChevronRight size={18} /> السابق
            </button>
            <span className="font-black text-gray-700 text-sm">
              صفحة {page} من {totalPages}
            </span>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-xl bg-white border-2 border-gray-200 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-sm flex items-center gap-1 transition-colors"
            >
              التالي <ChevronLeft size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                <FileText className="text-indigo-600" size={26} />
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
                  <p className="font-black text-indigo-700">{selectedInvoice.patient.fullName}</p>
                </div>
              )}
              {invoiceType === 'PURCHASE' && selectedInvoice.supplier && (
                <div className="col-span-2 pt-2 border-t border-gray-200">
                  <p className="text-gray-500 font-bold mb-1">المورد:</p>
                  <p className="font-black text-indigo-700">{selectedInvoice.supplier.name}</p>
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
                    <td className="p-3 font-black text-indigo-600">{item.subtotal} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-indigo-900 text-base">إجمالي الفاتورة:</span>
                <span className="font-black text-2xl text-indigo-700">{selectedInvoice.totalAmount} ج.م</span>
              </div>
              {invoiceType === 'PURCHASE' && selectedInvoice.paidAmount !== undefined && (
                <>
                  <div className="flex justify-between items-center border-t border-indigo-100 pt-2 text-sm">
                    <span className="font-bold text-emerald-800">المبلغ المدفوع من الخزينة:</span>
                    <span className="font-black text-emerald-600">{selectedInvoice.paidAmount} ج.م</span>
                  </div>
                  {selectedInvoice.totalAmount > selectedInvoice.paidAmount && (
                    <div className="flex justify-between items-center border-t border-indigo-100 pt-2 text-sm">
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
                  <Clock className="text-indigo-600" size={22} />
                  <span>تفاصيل حركة النظام</span>
                </h3>
                <p className="text-indigo-600 font-bold text-sm mt-1">
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
