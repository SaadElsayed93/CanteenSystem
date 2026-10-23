import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { 
  ArrowLeftRight, Wallet, Landmark, Banknote, 
  PlusCircle, MinusCircle, CheckCircle2, X, RefreshCw,
  Lock, Unlock, Printer, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { useShift } from '../shifts/ShiftContext';

const TreasuryPage = () => {
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { user, hasPermission } = useAuth();
  const isAdmin = user?.role?.name === 'مدير' || user?.role?.name === 'أدمن';
  const { isOpen, currentShift, setIsOpeningModal, setIsClosingModal } = useShift();
  const [activeTab, setActiveTab] = useState('TREASURY'); // TREASURY or EXPENSES
  
  // Modals for Expenses and Transfers
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ categoryId: '', amount: '', paymentMethodId: '', description: '', supplierId: '' });

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({ fromMethodId: '', toMethodId: '', amount: '', notes: '' });

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [isOpen]);

  const fetchData = async () => {
    try {
      const [balRes, txRes, expRes, catRes, supRes] = await Promise.all([
        client.get('/treasury/balances'),
        client.get('/treasury/transactions'),
        client.get('/treasury/expenses'),
        client.get('/treasury/expenses/categories'),
        client.get('/purchases/suppliers')
      ]);
      setBalances(balRes.data.data);
      setTransactions(txRes.data.data);
      setExpenses(expRes.data.data);
      setCategories(catRes.data.data);
      setSuppliers(supRes.data.data);
    } catch (err) {
      setError('فشل جلب بيانات الخزينة');
    } finally {
      setLoading(false);
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const selectedCat = categories.find(c => c.id === Number(expenseForm.categoryId));
    const isSupplierCat = selectedCat && selectedCat.name.includes('مورد');
    if (isSupplierCat && !expenseForm.supplierId) {
      return toast.error('يرجى اختيار المورد المراد سداد حسابه');
    }

    setIsSubmitting(true);
    try {
      await client.post('/treasury/expenses', {
        ...expenseForm,
        categoryId: Number(expenseForm.categoryId),
        amount: Number(expenseForm.amount),
        paymentMethodId: Number(expenseForm.paymentMethodId),
        supplierId: isSupplierCat ? Number(expenseForm.supplierId) : undefined
      });
      setIsExpenseModalOpen(false);
      setExpenseForm({ categoryId: '', amount: '', paymentMethodId: '', description: '', supplierId: '' });
      toast.success(isSupplierCat ? 'تم سداد حساب المورد وخصم المبلغ من الخزينة بنجاح' : 'تم تسجيل المصروف وخصمه بنجاح');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ في الخصم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!transferForm.fromMethodId || !transferForm.toMethodId) {
      return toast.error('يرجى اختيار القناة المصدر والقناة الهدف');
    }
    if (transferForm.fromMethodId === transferForm.toMethodId) {
      return toast.error('لا يمكن التحويل لنفس القناة');
    }
    if (Number(transferForm.amount) <= 0) {
      return toast.error('يرجى إدخال مبلغ تحويل صحيح');
    }

    setIsSubmitting(true);
    try {
      await client.post('/treasury/transfer', {
        fromMethodId: Number(transferForm.fromMethodId),
        toMethodId: Number(transferForm.toMethodId),
        amount: Number(transferForm.amount),
        notes: transferForm.notes
      });
      setIsTransferModalOpen(false);
      setTransferForm({ fromMethodId: '', toMethodId: '', amount: '', notes: '' });
      toast.success('تم تحويل المبلغ وتحديث الخزائن بنجاح');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل التحويل بين الخزائن');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMethodIcon = (name) => {
    if (name.includes('درج') || name.includes('نقدي')) return <Banknote className="text-emerald-600" size={26} />;
    if (name.includes('فودافون') || name.includes('كاش')) return <Wallet className="text-amber-600" size={26} />;
    return <Landmark className="text-[#007507]" size={26} />;
  };

  const getMethodBadgeColor = (name) => {
    if (name.includes('درج') || name.includes('نقدي')) return 'border-emerald-200 bg-emerald-50/50';
    if (name.includes('فودافون') || name.includes('كاش')) return 'border-amber-200 bg-amber-50/50';
    return 'border-emerald-200 bg-emerald-50/50';
  };

  if (loading) return (
    <div className="flex justify-center items-center h-96">
      <div className="text-xl font-bold text-gray-500 animate-pulse">جاري تحميل الخزينة والمصروفات...</div>
    </div>
  );

  const selectedSource = balances.find(b => b.id === Number(transferForm.fromMethodId));
  const drawerChannel = balances.find(b => b.name.includes('درج') || b.name.includes('نقدي'));
  const drawerBalance = drawerChannel ? Number(drawerChannel.currentBalance) : 0;

  const selectedExpenseCat = categories.find(c => c.id === Number(expenseForm.categoryId));
  const isSupplierCategory = selectedExpenseCat && selectedExpenseCat.name.includes('مورد');
  const selectedSupplierForExpense = suppliers.find(s => s.id === Number(expenseForm.supplierId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-100 gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2 flex-wrap">
            <span>الخزينة والمعاملات المالية</span>
            <span className="text-xs bg-emerald-50 text-[#007507] px-3 py-1 rounded-full font-bold border border-emerald-100">3 قنوات معتمدة</span>
            {isOpen ? (
              <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full font-bold border border-emerald-200 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                وردية نشطة #{currentShift?.shiftNumber}
              </span>
            ) : (
              <span className="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-bold border border-amber-200 flex items-center gap-1">
                <Lock size={12} />
                اليومية مغلقة
              </span>
            )}
          </h2>
          <p className="text-gray-400 font-bold text-sm mt-1">إدارة أرصدة الدرج، المحافظ الإلكترونية، والخزينة الرئيسية</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Action buttons are strictly reserved for Cashier / Sales (Admin has supervisory view only) */}
          {!isAdmin ? (
            <>
              {isOpen ? (
                <button 
                  onClick={() => setIsClosingModal(true)} 
                  className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-700 text-white font-black px-5 py-2.5 rounded-xl transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-2"
                  title="تقفيل الوردية اليومية وتوريد النقدية من الدرج إلى الخزينة الرئيسية"
                >
                  <Lock size={18} />
                  <span>تقفيل اليومية #{currentShift?.shiftNumber} (توريد الدرج)</span>
                </button>
              ) : (
                <button 
                  onClick={() => setIsOpeningModal(true)} 
                  className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2.5 rounded-xl transition-all shadow-md shadow-emerald-200 flex items-center justify-center gap-2"
                  title="فتح يومية ووردية جديدة"
                >
                  <Unlock size={18} />
                  <span>🔓 فتح يومية جديدة</span>
                </button>
              )}

              <button 
                onClick={() => setIsTransferModalOpen(true)} 
                className="flex-1 sm:flex-none bg-emerald-50 hover:bg-emerald-100 text-[#007507] border-2 border-emerald-200 font-bold px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeftRight size={18} />
                <span>تحويل بين الخزائن</span>
              </button>

              {hasPermission('CREATE_EXPENSE') && (
                <button 
                  onClick={() => setIsExpenseModalOpen(true)} 
                  className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-red-200 flex items-center justify-center gap-2"
                >
                  <span>- سحب مصروف جديد</span>
                </button>
              )}
            </>
          ) : (
            <span className="text-xs bg-emerald-50 text-[#007507] px-3.5 py-2 rounded-xl font-bold border border-emerald-100 flex items-center gap-1.5">
              <ShieldCheck size={16} />
              <span>لوحة الرقابة والمتابعة المالية (الإدارة)</span>
            </span>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-xl font-bold">{error}</div>}

      {/* 3 Channel Balances Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {balances.map(b => (
          <div 
            key={b.id} 
            className={`bg-white p-6 rounded-2xl shadow-sm border-2 relative overflow-hidden group hover:shadow-md transition-all ${getMethodBadgeColor(b.name)}`}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-gray-500 text-xs font-bold block mb-1">القناة المالية</span>
                <h3 className="text-lg font-black text-gray-800">{b.name}</h3>
              </div>
              <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
                {getMethodIcon(b.name)}
              </div>
            </div>
            <div className={`text-3xl font-black ${b.currentBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {b.currentBalance} <span className="text-base font-bold text-gray-500">ج.م</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border-2 border-gray-100 p-1">
        <button 
          className={`flex-1 py-3 text-center rounded-lg font-bold transition-all ${activeTab === 'TREASURY' ? 'bg-emerald-50 text-[#007507] shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('TREASURY')}
        >
          حركة الخزينة والتحويلات (الداخل والخارج)
        </button>
        <button 
          className={`flex-1 py-3 text-center rounded-lg font-bold transition-all ${activeTab === 'EXPENSES' ? 'bg-emerald-50 text-[#007507] shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('EXPENSES')}
        >
          سجل المصروفات
        </button>
      </div>

      {/* Tables View */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden">
        {activeTab === 'TREASURY' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead className="bg-gray-50 text-gray-700 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-bold">التاريخ والوقت</th>
                  <th className="p-4 font-bold">القناة المالية</th>
                  <th className="p-4 font-bold">نوع الحركة</th>
                  <th className="p-4 font-bold">المبلغ</th>
                  <th className="p-4 font-bold">البيان / التفاصيل</th>
                  <th className="p-4 font-bold">المسؤول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.length === 0 && (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-bold">لا توجد حركات مالية مسجلة</td></tr>
                )}
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 text-gray-500 font-bold text-xs">{new Date(t.createdAt).toLocaleString('ar-EG')}</td>
                    <td className="p-4 font-bold text-gray-800">{t.paymentMethod?.name || '-'}</td>
                    <td className="p-4">
                      {t.referenceType === 'DAILY_SETTLEMENT' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-fit">
                          <Lock size={12} />
                          {t.type === 'IN' ? 'توريد وردية (+)' : 'تقفيل وردية (-)'}
                        </span>
                      ) : t.referenceType === 'TRANSFER' ? (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-[#007507] border border-emerald-200 flex items-center gap-1 w-fit">
                          <ArrowLeftRight size={12} />
                          {t.type === 'IN' ? 'تحويل وارد (+)' : 'تحويل صادر (-)'}
                        </span>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${t.type === 'IN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {t.type === 'IN' ? 'وارد (+)' : 'منصرف (-)'}
                        </span>
                      )}
                    </td>
                    <td className={`p-4 font-black text-base ${t.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {t.amount} ج.م
                    </td>
                    <td className="p-4 font-bold text-gray-700">{t.description || '-'}</td>
                    <td className="p-4 text-gray-400 font-bold text-xs">{t.user?.fullName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'EXPENSES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead className="bg-gray-50 text-gray-700 border-b border-gray-100">
                <tr>
                  <th className="p-4 font-bold">التاريخ</th>
                  <th className="p-4 font-bold">البند (التصنيف)</th>
                  <th className="p-4 font-bold">المبلغ</th>
                  <th className="p-4 font-bold">القناة المالية</th>
                  <th className="p-4 font-bold">التفاصيل</th>
                  <th className="p-4 font-bold">المسؤول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {expenses.length === 0 && (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-bold">لا توجد مصروفات مسجلة</td></tr>
                )}
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-4 text-gray-500 font-bold text-xs">{new Date(e.createdAt).toLocaleString('ar-EG')}</td>
                    <td className="p-4 font-bold text-gray-800">{e.category?.name}</td>
                    <td className="p-4 font-black text-red-600 text-base">{e.amount} ج.م</td>
                    <td className="p-4 font-bold text-[#007507]">{e.paymentMethod?.name}</td>
                    <td className="p-4 font-bold text-gray-600">{e.description || '-'}</td>
                    <td className="p-4 text-gray-400 font-bold text-xs">{e.user?.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= Transfer Modal ================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-md">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <ArrowLeftRight className="text-[#007507]" size={22} />
                <span>تحويل بين الخزائن والقنوات</span>
              </h3>
              <button 
                onClick={() => setIsTransferModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">تحويل من (المصدر):</label>
                <select 
                  required 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 bg-white font-bold text-sm text-gray-800"
                  value={transferForm.fromMethodId} 
                  onChange={e => setTransferForm({ ...transferForm, fromMethodId: e.target.value })}
                >
                  <option value="">-- اختر القناة المحول منها --</option>
                  {balances.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} (المتاح: {b.currentBalance} ج.م)
                    </option>
                  ))}
                </select>
                {selectedSource && (
                  <p className="text-xs text-gray-500 font-bold mt-1">
                    الرصيد المتاح للتحويل: <span className="text-[#007507] font-black">{selectedSource.currentBalance} ج.م</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">تحويل إلى (الهدف):</label>
                <select 
                  required 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 bg-white font-bold text-sm text-gray-800"
                  value={transferForm.toMethodId} 
                  onChange={e => setTransferForm({ ...transferForm, toMethodId: e.target.value })}
                >
                  <option value="">-- اختر القناة المحول إليها --</option>
                  {balances
                    .filter(b => b.id !== Number(transferForm.fromMethodId))
                    .map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name} (الرصيد الحالي: {b.currentBalance} ج.م)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">المبلغ المراد تحويله (ج.م):</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  max={selectedSource ? selectedSource.currentBalance : undefined}
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 font-black text-[#007507] text-lg"
                  placeholder="0.00"
                  value={transferForm.amount} 
                  onChange={e => setTransferForm({ ...transferForm, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">ملاحظات / سبب التحويل (اختياري):</label>
                <textarea 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 text-sm font-bold text-gray-800"
                  rows="2"
                  placeholder="مثال: سحب نقدية من فودافون كاش وتوريدها للدرج..."
                  value={transferForm.notes} 
                  onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsTransferModalOpen(false)} 
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-[#007507] hover:bg-[#006006] text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري التحويل...' : 'تأكيد التحويل الآن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= Expense Modal ================= */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-md">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                <MinusCircle className="text-red-500" size={22} />
                <span>سحب مصروف جديد</span>
              </h3>
              <button 
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">بند المصروف:</label>
                <select 
                  required 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 bg-white font-bold text-sm text-gray-800" 
                  value={expenseForm.categoryId} 
                  onChange={e => setExpenseForm({ ...expenseForm, categoryId: e.target.value })}
                >
                  <option value="">-- اختر التصنيف --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Conditional Supplier Dropdown for "سداد لمورد" */}
              {isSupplierCategory && (
                <div className="bg-amber-50/80 border-2 border-amber-300 p-4 rounded-2xl space-y-2.5 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black text-amber-900 block">
                      🏢 اختر المورد المراد سداد حسابه:
                    </label>
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-full border border-amber-300">
                      يخصم من المديونية فوراً
                    </span>
                  </div>

                  <select 
                    required 
                    className="w-full border-2 border-amber-300 rounded-xl p-3 outline-none focus:border-amber-500 bg-white font-bold text-sm text-gray-800"
                    value={expenseForm.supplierId} 
                    onChange={e => {
                      const supId = e.target.value;
                      const sup = suppliers.find(s => s.id === Number(supId));
                      setExpenseForm({ 
                        ...expenseForm, 
                        supplierId: supId,
                        amount: sup && sup.currentDebt > 0 ? sup.currentDebt : expenseForm.amount
                      });
                    }}
                  >
                    <option value="">-- اختر المورد من القائمة --</option>
                    {suppliers.map(s => {
                      const debt = Number(s.currentDebt || 0);
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} (مديونية: {debt.toFixed(2)} ج.م)
                        </option>
                      );
                    })}
                  </select>

                  {selectedSupplierForExpense && (
                    <div className="flex justify-between items-center pt-1 px-1">
                      <div className="text-xs font-bold text-gray-700">
                        المديونية المستحقة علينا: 
                        <span className="font-black text-red-600 mr-1.5 text-sm">
                          {Number(selectedSupplierForExpense.currentDebt || 0).toFixed(2)} ج.م
                        </span>
                      </div>
                      {Number(selectedSupplierForExpense.currentDebt || 0) > 0 && (
                        <button 
                          type="button" 
                          onClick={() => setExpenseForm({ ...expenseForm, amount: selectedSupplierForExpense.currentDebt })}
                          className="text-xs text-[#007507] hover:text-[#003607] font-black underline bg-white px-2 py-1 rounded-md border border-amber-200"
                        >
                          سداد كامل المديونية ({Number(selectedSupplierForExpense.currentDebt).toFixed(2)} ج.م)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">المبلغ (ج.م):</label>
                <input 
                  required 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-red-500 font-black text-red-600 text-lg" 
                  value={expenseForm.amount} 
                  onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">القناة المالية (يُخصم من):</label>
                <select 
                  required 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 bg-white font-bold text-sm text-gray-800" 
                  value={expenseForm.paymentMethodId} 
                  onChange={e => setExpenseForm({ ...expenseForm, paymentMethodId: e.target.value })}
                >
                  <option value="">-- اختر القناة التي سيخرج منها المصروف --</option>
                  {balances.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} (رصيد متاح: {b.currentBalance} ج.م)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1.5 text-xs font-bold text-gray-700">تفاصيل / بيان المصروف:</label>
                <textarea 
                  className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-emerald-500 text-sm font-bold text-gray-800" 
                  rows="2"
                  value={expenseForm.description} 
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsExpenseModalOpen(false)} 
                  className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الخصم...' : 'تأكيد الخصم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TreasuryPage;
