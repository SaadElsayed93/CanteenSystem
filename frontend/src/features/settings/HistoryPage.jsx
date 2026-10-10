import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { Search, Filter, X, ChevronRight, ChevronLeft } from 'lucide-react';

const actionMap = {
  'CREATE': { label: 'إضافة جديدة', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  'UPDATE': { label: 'تعديل', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'DELETE': { label: 'حذف', color: 'bg-red-100 text-red-800 border-red-200' },
  'LOGIN': { label: 'تسجيل دخول', color: 'bg-gray-100 text-gray-800 border-gray-200' },
  'ADJUST': { label: 'تسوية مخزون', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'SALE': { label: 'عملية بيع', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'TRANSACT': { label: 'معاملة مالية', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  'RETURN': { label: 'مرتجع', color: 'bg-red-100 text-red-800 border-red-200' },
  'UPDATE_STATUS': { label: 'تحديث حالة', color: 'bg-teal-100 text-teal-800 border-teal-200' }
};

const entityMap = {
  'PRODUCT': 'الأصناف',
  'INVOICE': 'فواتير المبيعات',
  'USER': 'المستخدمين',
  'SUPPLIER': 'الموردين',
  'PURCHASE': 'فواتير المشتريات',
  'PATIENT': 'المرضى/العملاء',
  'SYSTEM': 'النظام',
  'EXPENSE': 'المصروفات',
  'TREASURY': 'الخزينة',
  'CATEGORY': 'الأقسام والتصنيفات',
  'SUPPLIER_PAYMENT': 'مدفوعات الموردين',
  'PATIENT_TX': 'معاملات المرضى',
  'RETURN': 'المرتجعات'
};

const keyTranslationMap = {
  totalAmount: 'إجمالي الفاتورة',
  type: 'النوع',
  itemCount: 'عدد الأصناف',
  patientName: 'العميل/المريض',
  itemNames: 'الأصناف',
  invoiceId: 'رقم الفاتورة',
  reason: 'السبب',
  paymentMethodId: 'طريقة الدفع (كود)',
  amount: 'المبلغ',
  description: 'البيان',
  supplierId: 'رقم المورد',
  referenceNo: 'الرقم المرجعي',
  paidAmount: 'المبلغ المدفوع',
  patientId: 'رقم المريض',
  categoryId: 'التصنيف',
  quantity: 'الكمية',
  isActive: 'مفعل',
  source: 'المصدر',
  name: 'الاسم'
};

const valueTranslationMap = {
  'CASH': 'نقدي',
  'CREDIT': 'آجل',
  'FULL': 'كلي',
  'PARTIAL': 'جزئي',
  'DEPOSIT': 'إيداع',
  'WITHDRAWAL': 'سحب',
  'IN': 'إضافة',
  'OUT': 'صرف'
};

const formatDetails = (newValues, isInline = false) => {
  if (!newValues) return 'لا توجد تفاصيل';
  try {
    const data = typeof newValues === 'string' ? JSON.parse(newValues) : newValues;
    return Object.entries(data)
      .filter(([key]) => key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'password')
      // If inline, hide complex arrays/objects or noisy IDs to make it clean
      .filter(([key]) => !isInline || (key !== 'items' && key !== 'returnItems' && key !== 'paymentMethodId' && key !== 'patientId' && key !== 'supplierId' && key !== 'categoryId'))
      .map(([key, value]) => {
        const arKey = keyTranslationMap[key] || key;
        
        let arValue = value;
        if (typeof value === 'boolean') arValue = value ? 'نعم' : 'لا';
        else if (valueTranslationMap[value]) arValue = valueTranslationMap[value];
        else if (typeof value === 'object' && value !== null) arValue = isInline ? '[تفاصيل...]' : JSON.stringify(value);
        
        // Hide empty fields inline
        if (isInline && (arValue === '' || arValue === null)) return null;

        return `${arKey}: ${arValue}`;
      })
      .filter(Boolean)
      .join(' | ');
  } catch (e) {
    return newValues;
  }
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
  const [genericDetails, setGenericDetails] = useState(null); // For universal details modal

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
        console.error(err);
      }
    } else if (log.entityType === 'PURCHASE' && log.entityId) {
      try {
        const res = await client.get(`/purchases/${log.entityId}`);
        setSelectedInvoice(res.data.data);
        setInvoiceType('PURCHASE');
      } catch (err) {
        console.error(err);
      }
    } else {
      // Generic details for EVERYTHING else
      setGenericDetails(log);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.user?.fullName?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.user?.username?.toLowerCase() || '').includes(search.toLowerCase()) ||
      formatDetails(log.newValues, true).toLowerCase().includes(search.toLowerCase());
      
    const matchesAction = !actionFilter || log.action === actionFilter;
    const matchesEntity = !entityFilter || log.entityType === entityFilter;

    return matchesSearch && matchesAction && matchesEntity;
  });

  const renderDetailsTable = (valuesStr) => {
    try {
      const data = typeof valuesStr === 'string' ? JSON.parse(valuesStr) : valuesStr;
      return (
        <table className="w-full text-right border-collapse text-sm">
          <tbody>
            {Object.entries(data).filter(([key]) => key !== 'password').map(([key, value]) => {
              const arKey = keyTranslationMap[key] || key;
              let arValue = value;
              if (typeof value === 'boolean') arValue = value ? 'نعم' : 'لا';
              else if (valueTranslationMap[value]) arValue = valueTranslationMap[value];
              
              return (
                <tr key={key} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="p-3 font-bold text-gray-700 bg-gray-50 w-1/3">{arKey}</td>
                  <td className="p-3 text-gray-800 font-bold" dir="ltr">
                    {typeof value === 'object' && value !== null ? (
                      <pre className="text-xs bg-gray-100 p-2 rounded text-left overflow-x-auto m-0">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    ) : String(arValue)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      );
    } catch {
      return <div className="p-4">{valuesStr}</div>;
    }
  };

  if (loading && logs.length === 0) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">سجل حركات النظام 🕒</h2>
          <p className="text-gray-500 mt-1">مراقبة كافة العمليات والتعديلات التي تمت في النظام</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="بحث في السجل..." 
              className="w-full border-2 border-gray-200 rounded-xl py-2 pr-10 pl-4 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-bold"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <select 
              className="w-full border-2 border-gray-200 rounded-xl py-2 pr-10 pl-4 outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-gray-700 appearance-none"
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
            >
              <option value="">كل الحركات</option>
              {Object.entries(actionMap).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <select 
              className="w-full border-2 border-gray-200 rounded-xl py-2 pr-10 pl-4 outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-gray-700 appearance-none"
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

      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 border-b font-bold">التاريخ والوقت</th>
                <th className="p-4 border-b font-bold">المستخدم</th>
                <th className="p-4 border-b font-bold">نوع الحركة</th>
                <th className="p-4 border-b font-bold">القسم</th>
                <th className="p-4 border-b font-bold">التفاصيل (اضغط للعرض الكامل)</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {filteredLogs.map(log => {
                const actionInfo = actionMap[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-800 border-gray-200' };
                const entityName = entityMap[log.entityType] || log.entityType;
                
                return (
                  <tr 
                    key={log.id} 
                    onClick={() => handleRowClick(log)}
                    className="border-b border-gray-50 transition-colors cursor-pointer hover:bg-indigo-50"
                  >
                    <td className="p-4 text-sm font-bold text-gray-500" dir="ltr">
                      {new Date(log.createdAt).toLocaleString('ar-EG')}
                    </td>
                    <td className="p-4 font-bold text-gray-800">
                      {log.user?.fullName || log.user?.username || 'مجهول'}
                    </td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${actionInfo.color}`}>
                        {actionInfo.label}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-gray-700">
                      {entityName} {log.entityId ? `(#${log.entityId})` : ''}
                    </td>
                    <td className="p-4 text-sm font-bold text-gray-600 max-w-md truncate" title="اضغط لعرض التفاصيل الكاملة">
                      {formatDetails(log.newValues, true)}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400 font-bold">لا توجد حركات مسجلة مطابقة للبحث</td></tr>
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
              className="p-2 rounded-lg bg-white border-2 border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center transition-colors"
            >
              <ChevronRight size={20} /> السابق
            </button>
            <span className="font-bold text-gray-700">
              صفحة {page} من {totalPages}
            </span>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg bg-white border-2 border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed font-bold flex items-center transition-colors"
            >
              التالي <ChevronLeft size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-2xl font-bold text-gray-800">
                {invoiceType === 'INVOICE' ? 'فاتورة مبيعات' : 'فاتورة مشتريات'} #{selectedInvoice.id}
              </h3>
              <button onClick={() => setSelectedInvoice(null)} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div>
                <p className="text-gray-500 text-sm mb-1">المستخدم / الكاشير:</p>
                <p className="font-bold text-gray-800">{selectedInvoice.user?.fullName || 'مجهول'}</p>
              </div>
              <div>
                <p className="text-gray-500 text-sm mb-1">التاريخ:</p>
                <p className="font-bold text-gray-800" dir="ltr">{new Date(selectedInvoice.createdAt).toLocaleString('ar-EG')}</p>
              </div>
              {invoiceType === 'INVOICE' && selectedInvoice.patient && (
                <div className="col-span-2">
                  <p className="text-gray-500 text-sm mb-1">المريض (العميل):</p>
                  <p className="font-bold text-indigo-700">{selectedInvoice.patient.fullName}</p>
                </div>
              )}
              {invoiceType === 'PURCHASE' && selectedInvoice.supplier && (
                <div className="col-span-2">
                  <p className="text-gray-500 text-sm mb-1">المورد:</p>
                  <p className="font-bold text-indigo-700">{selectedInvoice.supplier.name}</p>
                </div>
              )}
            </div>

            <h4 className="font-bold text-gray-700 mb-3">الأصناف:</h4>
            <table className="w-full text-right mb-6 border border-gray-200 rounded-xl overflow-hidden">
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
                    <td className="p-3 font-bold text-gray-800">{item.product?.name || 'صنف محذوف'}</td>
                    <td className="p-3 font-bold">{item.quantity}</td>
                    <td className="p-3">{item.unitPrice}</td>
                    <td className="p-3 font-bold text-indigo-600">{item.subtotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-indigo-900 text-lg">إجمالي الفاتورة:</span>
                <span className="font-black text-2xl text-indigo-700">{selectedInvoice.totalAmount} جنية</span>
              </div>
              {invoiceType === 'PURCHASE' && selectedInvoice.paidAmount !== undefined && (
                <>
                  <div className="flex justify-between items-center border-t border-indigo-100 pt-2">
                    <span className="font-bold text-emerald-800">المبلغ المدفوع (أثناء الإنشاء):</span>
                    <span className="font-bold text-emerald-600">{selectedInvoice.paidAmount} جنية</span>
                  </div>
                  {selectedInvoice.totalAmount > selectedInvoice.paidAmount && (
                    <div className="flex justify-between items-center border-t border-indigo-100 pt-2">
                      <span className="font-bold text-red-800">الباقي مديونية (عليك):</span>
                      <span className="font-bold text-red-600">{(selectedInvoice.totalAmount - selectedInvoice.paidAmount).toFixed(2)} جنية</span>
                    </div>
                  )}
                  {selectedInvoice.paidAmount > selectedInvoice.totalAmount && (
                    <div className="flex justify-between items-center border-t border-indigo-100 pt-2">
                      <span className="font-bold text-green-800">الزيادة المدفوعة (تقليل من ديون سابقة):</span>
                      <span className="font-bold text-green-600">{(selectedInvoice.paidAmount - selectedInvoice.totalAmount).toFixed(2)} جنية</span>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50">
              <div>
                <h3 className="text-2xl font-black text-gray-800">تفاصيل الحركة</h3>
                <p className="text-indigo-600 font-bold mt-1">
                  {entityMap[genericDetails.entityType] || genericDetails.entityType} {genericDetails.entityId ? `(#${genericDetails.entityId})` : ''} - {actionMap[genericDetails.action]?.label || genericDetails.action}
                </p>
              </div>
              <button onClick={() => setGenericDetails(null)} className="p-2 bg-white rounded-xl shadow-sm hover:bg-red-50 hover:text-red-600 text-gray-500 transition-colors border border-gray-200">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-xs text-gray-500 font-bold mb-1">المستخدم المنفذ</div>
                  <div className="font-bold text-gray-800">{genericDetails.user?.fullName || genericDetails.user?.username || 'النظام'}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-xs text-gray-500 font-bold mb-1">وقت التنفيذ</div>
                  <div className="font-bold text-gray-800" dir="ltr">{new Date(genericDetails.createdAt).toLocaleString('ar-EG')}</div>
                </div>
              </div>
              
              <h4 className="font-black text-gray-700 mb-3 border-b-2 border-indigo-100 inline-block pb-1">البيانات المسجلة (القيم الجديدة):</h4>
              <div className="border border-gray-200 rounded-xl overflow-hidden mb-6">
                {renderDetailsTable(genericDetails.newValues)}
              </div>

              {genericDetails.oldValues && (
                <>
                  <h4 className="font-black text-gray-700 mb-3 border-b-2 border-amber-100 inline-block pb-1 mt-4">البيانات السابقة (قبل التعديل):</h4>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {renderDetailsTable(genericDetails.oldValues)}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HistoryPage;
