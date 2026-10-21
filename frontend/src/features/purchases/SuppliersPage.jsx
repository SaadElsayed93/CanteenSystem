import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Building2, FileText, Printer, AlertCircle, 
  CheckCircle2, X, ShoppingCart, DollarSign, Wallet, Eye 
} from 'lucide-react';

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { hasPermission } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', notes: '' });

  // Direct Supplier Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedSupplierForPay, setSelectedSupplierForPay] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentMethodId: '', notes: '' });
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Statement Modal State
  const [isStatementOpen, setIsStatementOpen] = useState(false);
  const [statementData, setStatementData] = useState(null);
  const [isLoadingStatement, setIsLoadingStatement] = useState(false);

  // Purchase Invoice Details Modal State (viewable directly from statement)
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isLoadingPurchase, setIsLoadingPurchase] = useState(false);

  const handleViewPurchase = async (purchaseId) => {
    if (!purchaseId) return;
    setIsLoadingPurchase(true);
    try {
      const res = await client.get(`/purchases/${purchaseId}`);
      setSelectedPurchase(res.data.data);
    } catch (err) {
      toast.error('فشل في جلب تفاصيل الفاتورة');
    } finally {
      setIsLoadingPurchase(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const [suppRes, posRes] = await Promise.all([
        client.get('/purchases/suppliers'),
        client.get('/sales/pos-data')
      ]);
      setSuppliers(suppRes.data.data);
      if (posRes.data.data?.paymentMethods) {
        setPaymentMethods(posRes.data.data.paymentMethods);
      }
    } catch (err) {
      setError('فشل في جلب بيانات الموردين');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPayModal = (supplier) => {
    setSelectedSupplierForPay(supplier);
    setPayForm({
      amount: supplier.currentDebt > 0 ? String(supplier.currentDebt) : '',
      paymentMethodId: paymentMethods[0]?.id ? String(paymentMethods[0].id) : '',
      notes: ''
    });
    setIsPayModalOpen(true);
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingPay) return;
    const amountNum = Number(payForm.amount);
    if (!amountNum || amountNum <= 0) {
      toast.error('يرجى إدخال مبلغ دفع صحيح أكبر من صفر');
      return;
    }
    if (!payForm.paymentMethodId) {
      toast.error('يرجى اختيار الخزينة');
      return;
    }
    setIsSubmittingPay(true);
    try {
      await client.post('/purchases/payment', {
        supplierId: selectedSupplierForPay.id,
        amount: amountNum,
        paymentMethodId: Number(payForm.paymentMethodId),
        notes: payForm.notes
      });
      toast.success('تم تسجيل الدفعة للمورد وخصمها من الخزينة بنجاح');
      setIsPayModalOpen(false);
      fetchSuppliers();
      if (isStatementOpen && statementData?.supplier?.id === selectedSupplierForPay.id) {
        openStatement(selectedSupplierForPay.id);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل في تسجيل الدفعة');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post('/purchases/suppliers', form);
      setIsModalOpen(false);
      setForm({ name: '', address: '', notes: '' });
      fetchSuppliers();
      toast.success('تمت إضافة المورد بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await client.patch(`/purchases/suppliers/${id}/status`, { isActive: !currentStatus });
      fetchSuppliers();
      toast.success('تم تحديث الحالة بنجاح');
    } catch (err) {
      toast.error('فشل في تحديث الحالة');
    }
  };

  const openStatement = async (supplierId) => {
    setIsLoadingStatement(true);
    setIsStatementOpen(true);
    setStatementData(null);
    try {
      const res = await client.get(`/purchases/suppliers/${supplierId}/statement`);
      setStatementData(res.data.data);
    } catch (err) {
      toast.error('فشل تحميل كشف حساب المورد');
      setIsStatementOpen(false);
    } finally {
      setIsLoadingStatement(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="text-xl font-bold text-gray-500 animate-pulse">جاري تحميل بيانات الموردين...</div>
    </div>
  );

  const totalDebtAllSuppliers = suppliers.reduce((acc, s) => acc + Number(s.currentDebt || 0), 0);
  const totalPurchasesAll = suppliers.reduce((acc, s) => acc + Number(s.totalPurchases || 0), 0);
  const totalPaidAll = suppliers.reduce((acc, s) => acc + Number(s.totalPaid || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <Building2 className="text-indigo-600" size={28} />
            <span>إدارة الموردين وحسابات المشتريات</span>
          </h2>
          <p className="text-gray-400 font-bold text-sm mt-1">كشوفات حسابات الموردين، رصد الديون المستحقة، وإدارة الفواتير</p>
        </div>
        {hasPermission('MANAGE_PURCHASES') && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <Link 
              to="/purchases/new" 
              className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
            >
              <ShoppingCart size={18} />
              <span>+ فاتورة مشتريات جديدة</span>
            </Link>
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="flex-1 sm:flex-none bg-white hover:bg-indigo-50 text-indigo-600 border-2 border-indigo-600 font-bold px-5 py-2.5 rounded-xl transition-all shadow-sm"
            >
              + إضافة مورد جديد
            </button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-xl font-bold">{error}</div>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Debt Card */}
        <div className="bg-gradient-to-br from-red-50 to-rose-50/50 p-6 rounded-2xl border-2 border-red-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs font-bold text-red-700 block mb-1">إجمالي ديون كافة الموردين</span>
              <div className="text-3xl font-black text-red-600">
                {totalDebtAllSuppliers.toFixed(2)} <span className="text-sm font-bold text-red-400">ج.م</span>
              </div>
            </div>
            <div className="p-3 bg-red-100/80 rounded-xl text-red-600">
              <AlertCircle size={26} />
            </div>
          </div>
          <p className="text-xs font-bold text-red-500 mt-2">المبالغ المستحق سدادها للموردين</p>
        </div>

        {/* Total Purchases Card */}
        <div className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs font-bold text-gray-500 block mb-1">إجمالي المشتريات المسجلة</span>
              <div className="text-3xl font-black text-gray-900">
                {totalPurchasesAll.toFixed(2)} <span className="text-sm font-bold text-gray-400">ج.م</span>
              </div>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
              <ShoppingCart size={26} />
            </div>
          </div>
          <p className="text-xs font-bold text-gray-400 mt-2">قيمة كل فواتير الشراء</p>
        </div>

        {/* Total Paid Card */}
        <div className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs font-bold text-gray-500 block mb-1">إجمالي ما تم سداده</span>
              <div className="text-3xl font-black text-emerald-600">
                {totalPaidAll.toFixed(2)} <span className="text-sm font-bold text-emerald-400">ج.م</span>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
              <CheckCircle2 size={26} />
            </div>
          </div>
          <p className="text-xs font-bold text-gray-400 mt-2">دفعات الشراء والسداد النقدي</p>
        </div>

        {/* Suppliers Count Card */}
        <div className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm">
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="text-xs font-bold text-gray-500 block mb-1">عدد الموردين المسجلين</span>
              <div className="text-3xl font-black text-gray-900">
                {suppliers.length} <span className="text-sm font-bold text-gray-400">مورد</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl text-gray-600">
              <Building2 size={26} />
            </div>
          </div>
          <p className="text-xs font-bold text-gray-400 mt-2">النشط: {suppliers.filter(s => s.isActive).length} مورد</p>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead className="bg-gray-50 text-gray-700 border-b border-gray-100">
              <tr>
                <th className="p-4 font-bold">اسم المورد</th>
                <th className="p-4 font-bold">العنوان / التليفون</th>
                <th className="p-4 font-bold">إجمالي الفواتير</th>
                <th className="p-4 font-bold">المسدد</th>
                <th className="p-4 font-bold text-red-600">المديونية (المستحق له)</th>
                <th className="p-4 font-bold">ملاحظات</th>
                <th className="p-4 font-bold">الحالة</th>
                <th className="p-4 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {suppliers.map(s => {
                const debt = Number(s.currentDebt || 0);
                return (
                  <tr key={s.id} className={`hover:bg-gray-50/80 transition-colors ${!s.isActive ? 'bg-gray-50/50 opacity-60' : ''}`}>
                    <td className="p-4 font-black text-gray-900 text-base">{s.name}</td>
                    <td className="p-4 font-bold text-gray-600">{s.address || '-'}</td>
                    <td className="p-4 font-bold text-gray-800">{Number(s.totalPurchases || 0).toFixed(2)} ج.م</td>
                    <td className="p-4 font-bold text-emerald-600">{Number(s.totalPaid || 0).toFixed(2)} ج.م</td>
                    <td className="p-4">
                      {debt > 0 ? (
                        <span className="font-black text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full text-sm inline-block">
                          {debt.toFixed(2)} ج.م
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full text-xs inline-block">
                          خالص (0.00 ج.م)
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs font-bold text-gray-500 max-w-xs truncate">{s.notes || '-'}</td>
                    <td className="p-4">
                      {s.isActive ? (
                        <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">نشط</span>
                      ) : (
                        <span className="bg-red-50 text-red-700 px-3 py-1 rounded-full text-xs font-bold border border-red-200">معطل</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => openStatement(s.id)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold px-3.5 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5"
                          title="عرض كشف الحساب التفصيلي"
                        >
                          <FileText size={15} />
                          <span>كشف الحساب</span>
                        </button>

                        {hasPermission('MANAGE_PURCHASES') && s.isActive && (
                          <button 
                            onClick={() => handleOpenPayModal(s)}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1.5"
                            title="سداد دفعة نقدية للمورد"
                          >
                            <Wallet size={14} />
                            <span>سداد دفعة</span>
                          </button>
                        )}

                        {hasPermission('MANAGE_PURCHASES') && (
                          <button 
                            onClick={() => toggleStatus(s.id, s.isActive)} 
                            className={`font-bold text-xs px-3 py-1.5 rounded-lg border transition-all ${
                              s.isActive 
                                ? 'bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 border-gray-200 hover:border-red-200' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                          >
                            {s.isActive ? 'إيقاف' : 'تفعيل'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {suppliers.length === 0 && (
                <tr><td colSpan="8" className="p-8 text-center text-gray-400 font-bold">لا يوجد موردين مسجلين حتى الآن</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ================= Add Supplier Modal ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-md">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <Building2 className="text-indigo-600" size={22} />
                <span>إضافة مورد جديد</span>
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">اسم المورد أو الشركة:</label>
                <input 
                  required 
                  type="text" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold text-sm text-gray-800" 
                  placeholder="مثال: شركة الأمل للمشروبات..."
                  value={form.name} 
                  onChange={e => setForm({...form, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">العنوان أو رقم الهاتف (اختياري):</label>
                <input 
                  type="text" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold text-sm text-gray-800" 
                  placeholder="رقم الهاتف أو العنوان..."
                  value={form.address} 
                  onChange={e => setForm({...form, address: e.target.value})}
                />
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">ملاحظات (اختياري):</label>
                <textarea 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 text-sm font-bold text-gray-800" 
                  rows="2"
                  placeholder="شروط السداد، المندوب، إلخ..."
                  value={form.notes} 
                  onChange={e => setForm({...form, notes: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all"
                >
                  حفظ المورد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= Direct Supplier Payment Modal ================= */}
      {isPayModalOpen && selectedSupplierForPay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-md">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <Wallet className="text-emerald-600" size={22} />
                <span>سداد دفعة للمورد 💵</span>
              </h3>
              <button 
                onClick={() => setIsPayModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl mb-4">
              <div className="text-xs font-bold text-emerald-800 mb-1">اسم المورد:</div>
              <div className="text-lg font-black text-gray-900">{selectedSupplierForPay.name}</div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-emerald-100 text-xs">
                <span className="font-bold text-gray-600">المديونية الحالية المستحقة له:</span>
                <span className="font-black text-red-600 text-sm">
                  {Number(selectedSupplierForPay.currentDebt || 0).toFixed(2)} ج.م
                </span>
              </div>
            </div>

            <form onSubmit={handlePaySubmit} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-gray-700">مبلغ الدفعة المسدد (ج.م):</label>
                  {Number(selectedSupplierForPay.currentDebt || 0) > 0 && (
                    <button 
                      type="button" 
                      onClick={() => setPayForm({...payForm, amount: String(selectedSupplierForPay.currentDebt)})}
                      className="text-[11px] font-bold text-emerald-600 hover:underline"
                    >
                      سداد كامل المديونية ({Number(selectedSupplierForPay.currentDebt).toFixed(2)})
                    </button>
                  )}
                </div>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 font-black text-lg text-emerald-700" 
                  placeholder="0.00"
                  value={payForm.amount} 
                  onChange={e => setPayForm({...payForm, amount: e.target.value})}
                />
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">خصم الدفعة من (الخزينة):</label>
                <select 
                  required 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 font-bold text-sm text-gray-800 bg-white"
                  value={payForm.paymentMethodId}
                  onChange={e => setPayForm({...payForm, paymentMethodId: e.target.value})}
                >
                  <option value="">-- اختر الخزينة التي تم الصرف منها --</option>
                  {paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name} (الرصيد المتاح: {Number(pm.currentBalance || 0).toFixed(2)} ج.م)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">ملاحظات أو رقم الإيصال (اختياري):</label>
                <input 
                  type="text" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 text-sm font-bold text-gray-800" 
                  placeholder="سداد دفعة تحت الحساب، إيصال استلام..."
                  value={payForm.notes} 
                  onChange={e => setPayForm({...payForm, notes: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsPayModalOpen(false)} 
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmittingPay}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
                >
                  {isSubmittingPay ? 'جاري السداد...' : 'تأكيد السداد والخصم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= Supplier Statement Modal ================= */}
      {isStatementOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 print:static print:p-0 print:bg-white print:block">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-5xl max-h-[90vh] flex flex-col print:shadow-none print:border-none print:p-0 print:max-h-none print:h-auto print:max-w-none print:rounded-none">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100 print:border-b-2 print:border-black print:pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl print:hidden">
                  <FileText size={26} />
                </div>
                <div>
                  <div className="inline-block bg-indigo-50 text-indigo-900 text-[11px] font-black px-2.5 py-0.5 rounded-full mb-1 border border-indigo-200 print:border-none print:p-0 print:text-black print:font-bold">
                    المستشفى العسكري ق.م بالإسماعيلية - إدارة الكانتين
                  </div>
                  <h3 className="text-xl font-black text-gray-900">
                    كشف حساب المورد: {statementData ? statementData.supplier.name : 'جاري التحميل...'}
                  </h3>
                  {statementData && (
                    <p className="text-xs font-bold text-gray-500 mt-0.5">
                      {statementData.supplier.address && <span>{statementData.supplier.address} • </span>}
                      <span>تاريخ استخراج الكشف: {new Date().toLocaleDateString('ar-EG')}</span>
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 print:hidden">
                {hasPermission('MANAGE_PURCHASES') && statementData?.supplier && (
                  <button 
                    type="button" 
                    onClick={() => handleOpenPayModal(statementData.supplier)} 
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs shadow-md shadow-emerald-100"
                  >
                    <Wallet size={16} />
                    <span>سداد دفعة للمورد</span>
                  </button>
                )}
                <button 
                  type="button" 
                  onClick={() => window.print()} 
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center gap-1.5 text-xs shadow-md shadow-indigo-100"
                >
                  <Printer size={16} />
                  <span>طباعة الكشف كاملاً</span>
                </button>
                <button 
                  onClick={() => setIsStatementOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-2 rounded-xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-5 space-y-5 print:overflow-visible print:h-auto print:py-3 print:space-y-4" id="supplier-statement-print">
              {isLoadingStatement && (
                <div className="py-20 text-center font-bold text-gray-400 animate-pulse">
                  جاري جلب حركات كشف الحساب من قاعدة البيانات...
                </div>
              )}

              {statementData && (
                <>
                  {/* Summary Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl text-center">
                      <span className="text-xs font-bold text-gray-500 block mb-1">إجمالي فواتير المشتريات</span>
                      <span className="text-2xl font-black text-gray-800">
                        {statementData.summary.totalPurchases.toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-center">
                      <span className="text-xs font-bold text-emerald-800 block mb-1">إجمالي ما تم سداده للمورد</span>
                      <span className="text-2xl font-black text-emerald-700">
                        {statementData.summary.totalPaid.toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="bg-red-50 border border-red-200 p-4 rounded-2xl text-center">
                      <span className="text-xs font-bold text-red-800 block mb-1">صافي المديونية المتبقية له</span>
                      <span className="text-2xl font-black text-red-600">
                        {statementData.summary.currentDebt.toFixed(2)} ج.م
                      </span>
                    </div>
                  </div>

                  {/* Ledger Table */}
                  <div className="border-2 border-gray-100 rounded-2xl overflow-hidden shadow-sm print:border print:border-gray-300">
                    <table className="w-full text-right border-collapse text-xs">
                      <thead className="bg-gray-50 text-gray-700 border-b border-gray-100 print:bg-gray-100">
                        <tr>
                          <th className="p-3 font-bold">التاريخ</th>
                          <th className="p-3 font-bold">نوع الحركة</th>
                          <th className="p-3 font-bold">المرجع</th>
                          <th className="p-3 font-bold">البيان والتفاصيل</th>
                          <th className="p-3 font-bold text-red-600">دائن (فاتورة +)</th>
                          <th className="p-3 font-bold text-emerald-600">مدين (سداد -)</th>
                          <th className="p-3 font-bold text-gray-900">الرصيد المستحق</th>
                          <th className="p-3 font-bold">المسؤول</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {statementData.entries.length === 0 && (
                          <tr><td colSpan="8" className="p-8 text-center text-gray-400 font-bold">لا توجد حركات مسجلة لهذا المورد</td></tr>
                        )}
                        {statementData.entries.map(entry => (
                          <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-3 text-gray-500 font-bold whitespace-nowrap">
                              {new Date(entry.date).toLocaleString('ar-EG')}
                            </td>
                            <td className="p-3">
                              {entry.type === 'PURCHASE' ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewPurchase(entry.purchaseId)}
                                  className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1 shadow-sm print:border-none print:p-0 print:text-indigo-900"
                                  title="انقر لفتح تفاصيل الفاتورة كاملة"
                                >
                                  <Eye size={13} className="print:hidden" />
                                  <span>فاتورة مشتريات</span>
                                </button>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  سداد نقدي
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-mono font-bold text-gray-700">
                              {entry.type === 'PURCHASE' ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewPurchase(entry.purchaseId)}
                                  className="text-indigo-600 hover:text-indigo-900 hover:underline font-black cursor-pointer print:text-black"
                                  title="فتح تفاصيل الفاتورة"
                                >
                                  {entry.reference}
                                </button>
                              ) : (
                                entry.reference
                              )}
                            </td>
                            <td className="p-3 font-bold text-gray-800">
                              <div className="flex items-center gap-2">
                                <span>{entry.description}</span>
                                {entry.type === 'PURCHASE' && (
                                  <button
                                    type="button"
                                    onClick={() => handleViewPurchase(entry.purchaseId)}
                                    className="text-[10px] font-black text-indigo-600 hover:underline bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-100 transition-colors print:hidden"
                                    title="عرض الفاتورة بالتفصيل"
                                  >
                                    فتح الفاتورة 🔍
                                  </button>
                                )}
                              </div>
                              {entry.items && entry.items.length > 0 && (
                                <div className="text-[11px] text-gray-400 mt-1 space-x-1 space-x-reverse">
                                  {entry.items.map((it, idx) => (
                                    <span key={idx} className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 inline-block mr-1">
                                      {it.productName} ({it.quantity} {it.unitName})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="p-3 font-black text-red-600">
                              {entry.credit > 0 ? `${entry.credit.toFixed(2)} ج.م` : '-'}
                            </td>
                            <td className="p-3 font-black text-emerald-600">
                              {entry.debit > 0 ? `${entry.debit.toFixed(2)} ج.م` : '-'}
                            </td>
                            <td className="p-3 font-black text-gray-900 bg-gray-50/70">
                              {entry.runningBalance.toFixed(2)} ج.م
                            </td>
                            <td className="p-3 text-gray-400 font-bold">{entry.user}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-gray-100 flex justify-end print:hidden">
              <button 
                type="button" 
                onClick={() => setIsStatementOpen(false)} 
                className="px-6 py-2.5 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 transition-all text-sm"
              >
                إغلاق كشف الحساب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= Purchase Invoice Details Drilldown Modal ================= */}
      {selectedPurchase && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100">
            {/* Header */}
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl">
                  <FileText size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900">
                    فاتورة مشتريات #{selectedPurchase.id} {selectedPurchase.referenceNo ? `(${selectedPurchase.referenceNo})` : ''}
                  </h3>
                  <p className="text-xs font-bold text-gray-400 mt-0.5">
                    المستشفى العسكري ق.م بالإسماعيلية • إدارة الكانتين
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedPurchase(null)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 transition-colors"
                title="إغلاق"
              >
                ✕
              </button>
            </div>

            {/* Meta info card */}
            <div className="my-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-xs font-bold grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-gray-400 block mb-0.5">اسم المورد:</span>
                <span className="text-indigo-900 font-black text-sm">{selectedPurchase.supplier?.name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">تاريخ ووقت الفاتورة:</span>
                <span className="text-gray-800 font-mono" dir="ltr">{new Date(selectedPurchase.createdAt).toLocaleString('ar-EG')}</span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">المسؤول / المدخل:</span>
                <span className="text-gray-800">{selectedPurchase.user?.fullName || '-'}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto mb-4 border border-gray-100 rounded-2xl">
              <table className="w-full text-right text-xs border-collapse">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-100 font-bold sticky top-0">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">الصنف</th>
                    <th className="p-3">الكمية</th>
                    <th className="p-3">سعر الشراء (التكلفة)</th>
                    <th className="p-3">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-bold">
                  {selectedPurchase.items?.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-400">{idx + 1}</td>
                      <td className="p-3 text-gray-900">{it.product?.name || it.productName || 'صنف مسجل'}</td>
                      <td className="p-3 text-indigo-700">{it.quantity} {it.product?.unit || 'قطعة'}</td>
                      <td className="p-3 text-gray-700">{Number(it.unitCost).toFixed(2)} ج.م</td>
                      <td className="p-3 font-black text-gray-900">{Number(it.subtotal).toFixed(2)} ج.م</td>
                    </tr>
                  ))}
                  {(!selectedPurchase.items || selectedPurchase.items.length === 0) && (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-gray-400 font-bold">لا توجد أصناف مسجلة في الفاتورة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary Card */}
            <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 space-y-2 text-xs font-bold">
              <div className="flex justify-between items-center text-sm">
                <span className="text-indigo-900 font-black">إجمالي قيمة الفاتورة:</span>
                <span className="text-xl font-black text-indigo-700">{Number(selectedPurchase.totalAmount).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center border-t border-indigo-100 pt-2">
                <span className="text-emerald-800 font-bold">المبلغ المسدد من الخزينة:</span>
                <span className="text-base font-black text-emerald-700">{Number(selectedPurchase.paidAmount || 0).toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between items-center border-t border-indigo-100 pt-2">
                <span className="text-red-700 font-bold">المتبقي كمديونية للمورد:</span>
                <span className="text-base font-black text-red-600">
                  {Math.max(0, Number(selectedPurchase.totalAmount) - Number(selectedPurchase.paidAmount || 0)).toFixed(2)} ج.م
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
              <span className={`px-3 py-1 rounded-full text-xs font-black ${
                Number(selectedPurchase.paidAmount || 0) >= Number(selectedPurchase.totalAmount)
                  ? 'bg-emerald-100 text-emerald-800'
                  : Number(selectedPurchase.paidAmount || 0) > 0
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {Number(selectedPurchase.paidAmount || 0) >= Number(selectedPurchase.totalAmount)
                  ? 'فاتورة خالصة ومسددة بالكامل'
                  : Number(selectedPurchase.paidAmount || 0) > 0
                  ? 'مسددة جزئياً'
                  : 'فاتورة آجلة (غير مدفوعة)'}
              </span>
              <button 
                onClick={() => setSelectedPurchase(null)}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-xl transition-colors text-xs"
              >
                العودة لكشف الحساب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
