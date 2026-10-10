import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import toast from 'react-hot-toast';
import { Search, Filter, FileText, X } from 'lucide-react';

const actionMap = {
  'CREATE': { label: 'إضافة جديدة', color: 'bg-green-100 text-green-800 border-green-200' },
  'UPDATE': { label: 'تعديل بيانات', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'DELETE': { label: 'حذف', color: 'bg-red-100 text-red-800 border-red-200' },
  'LOGIN': { label: 'تسجيل دخول', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'SALE': { label: 'عملية بيع', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'ADJUST_INVENTORY': { label: 'تسوية مخزون', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'PURCHASE': { label: 'عملية شراء', color: 'bg-teal-100 text-teal-800 border-teal-200' },
  'UPDATE_STATUS': { label: 'تغيير حالة', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'PAY': { label: 'دفع مالي', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  'WITHDRAW': { label: 'سحب', color: 'bg-red-100 text-red-800 border-red-200' },
  'DEPOSIT': { label: 'إيداع', color: 'bg-green-100 text-green-800 border-green-200' },
  'RETURN': { label: 'عملية استرجاع', color: 'bg-red-100 text-red-800 border-red-200' }
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

const fieldTranslations = {
  fullName: 'الاسم',
  username: 'اسم المستخدم',
  password: 'كلمة المرور',
  name: 'الاسم',
  internalCode: 'الكود الداخلي',
  barcode: 'الباركود',
  sellingPrice: 'سعر البيع',
  purchasePrice: 'سعر الشراء',
  unit: 'الوحدة',
  packageUnit: 'وحدة التعبئة',
  piecesPerPackage: 'الكمية في التعبئة',
  alertThreshold: 'حد التنبيه',
  isActive: 'مفعل',
  totalAmount: 'إجمالي الفاتورة',
  type: 'نوع الحركة/الدفع',
  itemCount: 'عدد الأصناف',
  patientName: 'اسم المريض (للآجل)',
  address: 'العنوان',
  notes: 'ملاحظات',
  roleId: 'الصلاحية',
  supplierId: 'كود المورد',
  referenceNo: 'الرقم المرجعي',
  paidAmount: 'المبلغ المدفوع',
  paymentMethodId: 'كود الخزينة',
  categoryId: 'كود تصنيف المصروف',
  amount: 'المبلغ',
  description: 'البيان',
  quantity: 'الكمية',
  reason: 'السبب',
  patientId: 'كود المريض',
  initialBalance: 'الرصيد الافتتاحي',
  source: 'المصدر',
  balanceAfter: 'الرصيد بعد الحركة',
  fileNumber: 'رقم الملف',
  internalNumber: 'الرقم الداخلي (السرير)',
  items: 'الأصناف',
  IN: 'إيداع/دخول',
  OUT: 'سحب/خروج',
  CASH: 'نقدي',
  CREDIT: 'آجل'
};

const formatDetails = (jsonStr) => {
  if (!jsonStr || jsonStr === 'null' || jsonStr === '{}') return 'لا توجد تفاصيل إضافية';
  try {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed !== 'object') return String(parsed);
    
    return Object.entries(parsed).map(([key, val]) => {
      const translatedKey = fieldTranslations[key] || key;
      let translatedVal = val;
      
      if (val === null || val === 'null' || val === '') {
        translatedVal = 'لا يوجد';
      } else if (typeof val === 'boolean') {
        translatedVal = val ? 'نعم' : 'لا';
      } else if (key === 'items' && Array.isArray(val)) {
        translatedVal = '(مرفقة داخل الفاتورة)';
      } else if (typeof val === 'object') {
        translatedVal = '(تفاصيل معقدة)';
      } else if (fieldTranslations[val]) {
        translatedVal = fieldTranslations[val];
      }
      
      return `${translatedKey}: ${translatedVal}`;
    }).join(' | ');
  } catch {
    return jsonStr;
  }
};

const HistoryPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceType, setInvoiceType] = useState(''); // 'INVOICE' or 'PURCHASE'

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await client.get('/audit-logs');
      setLogs(res.data.data);
    } catch (err) {
      toast.error('فشل جلب سجل الحركات');
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
        toast.error('فشل جلب تفاصيل الفاتورة');
      }
    } else if (log.entityType === 'PURCHASE' && log.entityId) {
      try {
        const res = await client.get(`/purchases/${log.entityId}`);
        setSelectedInvoice(res.data.data);
        setInvoiceType('PURCHASE');
      } catch (err) {
        toast.error('فشل جلب تفاصيل فاتورة المشتريات');
      }
    }
  };

  const filteredLogs = logs.filter(log => {
    const details = formatDetails(log.newValues);
    const userName = log.user?.fullName || log.user?.username || '';
    const matchSearch = details.includes(search) || userName.includes(search) || (log.entityId && log.entityId.toString().includes(search));
    const matchAction = actionFilter ? log.action === actionFilter : true;
    const matchEntity = entityFilter ? log.entityType === entityFilter : true;
    
    return matchSearch && matchAction && matchEntity;
  });

  if (loading) return <div className="text-center mt-10 font-bold text-gray-500">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 gap-4">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FileText className="text-indigo-600" size={28} />
          سجل الحركات (History)
        </h2>
        
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute right-3 top-3 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="ابحث في التفاصيل أو المستخدم..." 
              className="w-full border-2 border-gray-200 rounded-xl pr-10 p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-gray-700"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select 
            className="border-2 border-gray-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-gray-700 bg-white"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
          >
            <option value="">كل الحركات</option>
            {Object.entries(actionMap).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
          <select 
            className="border-2 border-gray-200 rounded-xl p-2 outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-bold text-gray-700 bg-white"
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

      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 border-b font-bold w-48">التاريخ والوقت</th>
                <th className="p-4 border-b font-bold">المستخدم</th>
                <th className="p-4 border-b font-bold">نوع الحركة</th>
                <th className="p-4 border-b font-bold">القسم</th>
                <th className="p-4 border-b font-bold">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {filteredLogs.map(log => {
                const actionInfo = actionMap[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-800 border-gray-200' };
                const entityName = entityMap[log.entityType] || log.entityType;
                const isClickable = (log.entityType === 'INVOICE' || log.entityType === 'PURCHASE') && log.entityId;
                
                return (
                  <tr 
                    key={log.id} 
                    onClick={() => isClickable && handleRowClick(log)}
                    className={`border-b border-gray-50 transition-colors ${isClickable ? 'cursor-pointer hover:bg-indigo-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="p-4 text-sm font-bold text-gray-500">
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
                    <td className="p-4 text-sm font-bold text-gray-600 max-w-md truncate" title={formatDetails(log.newValues)}>
                      {formatDetails(log.newValues)}
                      {isClickable && <span className="ml-2 text-indigo-500 text-xs">(اضغط لعرض الفاتورة)</span>}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400 font-bold">لا توجد حركات مسجلة تطابق بحثك</td></tr>
              )}
            </tbody>
          </table>
        </div>
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
                <p className="font-bold text-gray-800">{new Date(selectedInvoice.createdAt).toLocaleString('ar-EG')}</p>
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
                      <span className="font-bold text-green-800">الزيادة المدفوعة (تُخصم من ديون أخرى):</span>
                      <span className="font-bold text-green-600">{(selectedInvoice.paidAmount - selectedInvoice.totalAmount).toFixed(2)} جنية</span>
                    </div>
                  )}
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


