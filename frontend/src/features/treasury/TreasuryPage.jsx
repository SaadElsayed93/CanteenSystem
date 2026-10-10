import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const TreasuryPage = () => {
  const [balances, setBalances] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('TREASURY'); // TREASURY or EXPENSES
  
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ categoryId: '', amount: '', paymentMethodId: '', description: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [balRes, txRes, expRes, catRes] = await Promise.all([
        client.get('/treasury/balances'),
        client.get('/treasury/transactions'),
        client.get('/treasury/expenses'),
        client.get('/treasury/expenses/categories')
      ]);
      setBalances(balRes.data.data);
      setTransactions(txRes.data.data);
      setExpenses(expRes.data.data);
      setCategories(catRes.data.data);
    } catch (err) {
      setError('فشل جلب بيانات الخزينة');
    } finally {
      setLoading(false);
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post('/treasury/expenses', {
        ...expenseForm,
        categoryId: Number(expenseForm.categoryId),
        amount: Number(expenseForm.amount),
        paymentMethodId: Number(expenseForm.paymentMethodId)
      });
      setIsExpenseModalOpen(false);
      setExpenseForm({ categoryId: '', amount: '', paymentMethodId: '', description: '' });
      fetchData(); // refresh balances and transactions
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">الخزينة والمصروفات</h2>
        {hasPermission('CREATE_EXPENSE') && (
          <button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-red-700 transition-all shadow-md shadow-red-200">
            - سحب مصروف جديد
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg font-bold">{error}</div>}

      {/* Balances Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {balances.map(b => (
          <div key={b.id} className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 relative overflow-hidden group hover:shadow-md transition-all">
            <div className={`absolute top-0 left-0 w-full h-1.5 ${b.currentBalance < 0 ? 'bg-red-500' : 'bg-indigo-500'}`}></div>
            <h3 className="text-gray-500 text-sm font-bold mb-2">{b.name}</h3>
            <div className={`text-4xl font-black ${b.currentBalance < 0 ? 'text-red-600' : 'text-indigo-700'}`}>
              {b.currentBalance} <span className="text-lg font-normal text-gray-400">جنية</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-white rounded-xl shadow-sm border-2 border-gray-200 p-1 mb-6">
        <button 
          className={`flex-1 py-3 text-center rounded-lg font-bold transition-all ${activeTab === 'TREASURY' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('TREASURY')}
        >
          حركة الخزينة (الداخل والخارج)
        </button>
        <button 
          className={`flex-1 py-3 text-center rounded-lg font-bold transition-all ${activeTab === 'EXPENSES' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setActiveTab('EXPENSES')}
        >
          سجل المصروفات
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
        {activeTab === 'TREASURY' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="p-4 border-b font-bold">التاريخ</th>
                  <th className="p-4 border-b font-bold">الخزينة</th>
                  <th className="p-4 border-b font-bold">النوع</th>
                  <th className="p-4 border-b font-bold">المبلغ</th>
                  <th className="p-4 border-b font-bold">البيان</th>
                  <th className="p-4 border-b font-bold">المستخدم</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {transactions.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-500">لا توجد حركات مالية</td></tr>}
                {transactions.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 border-b">{new Date(t.createdAt).toLocaleString('ar-EG')}</td>
                    <td className="p-4 border-b font-bold text-gray-800">{t.paymentMethod.name}</td>
                    <td className="p-4 border-b">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${t.type === 'IN' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {t.type === 'IN' ? 'وارد (+)' : 'منصرف (-)'}
                      </span>
                    </td>
                    <td className={`p-4 border-b font-bold text-lg ${t.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>{t.amount}</td>
                    <td className="p-4 border-b">{t.description || '-'}</td>
                    <td className="p-4 border-b text-gray-500">{t.user.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'EXPENSES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="p-4 border-b font-bold">التاريخ</th>
                  <th className="p-4 border-b font-bold">البند (التصنيف)</th>
                  <th className="p-4 border-b font-bold">المبلغ</th>
                  <th className="p-4 border-b font-bold">طريقة الدفع</th>
                  <th className="p-4 border-b font-bold">التفاصيل</th>
                  <th className="p-4 border-b font-bold">المستخدم</th>
                </tr>
              </thead>
              <tbody className="text-gray-600">
                {expenses.length === 0 && <tr><td colSpan="6" className="p-8 text-center text-gray-500">لا توجد مصروفات</td></tr>}
                {expenses.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 border-b">{new Date(e.createdAt).toLocaleString('ar-EG')}</td>
                    <td className="p-4 border-b font-bold text-gray-800">{e.category.name}</td>
                    <td className="p-4 border-b font-bold text-lg text-red-600">{e.amount}</td>
                    <td className="p-4 border-b font-bold text-indigo-700">{e.paymentMethod.name}</td>
                    <td className="p-4 border-b">{e.description || '-'}</td>
                    <td className="p-4 border-b text-gray-500">{e.user.fullName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b border-gray-100 pb-4">💸 سحب مصروف جديد</h3>
            <form onSubmit={handleExpenseSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block mb-2 text-sm font-bold text-gray-700">بند المصروف</label>
                <select required className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={expenseForm.categoryId} onChange={e=>setExpenseForm({...expenseForm, categoryId: e.target.value})}>
                  <option value="">-- اختر التصنيف --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-2 text-sm font-bold text-gray-700">المبلغ</label>
                <input required type="number" step="0.01" min="0.01" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-red-600 text-lg" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm, amount: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 text-sm font-bold text-gray-700">الخزينة (طريقة الدفع)</label>
                <select required className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={expenseForm.paymentMethodId} onChange={e=>setExpenseForm({...expenseForm, paymentMethodId: e.target.value})}>
                  <option value="">-- اختر الخزينة --</option>
                  {balances.map(b => <option key={b.id} value={b.id}>{b.name} (رصيد: {b.currentBalance})</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-2 text-sm font-bold text-gray-700">تفاصيل / بيان (اختياري)</label>
                <textarea className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm, description: e.target.value})}></textarea>
              </div>
              
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200">تأكيد الخصم</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreasuryPage;
