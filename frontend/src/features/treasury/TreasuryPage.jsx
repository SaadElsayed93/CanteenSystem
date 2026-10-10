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
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">الخزينة والمصروفات</h2>
        {hasPermission('CREATE_EXPENSE') && (
          <button onClick={() => setIsExpenseModalOpen(true)} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">
            - سحب مصروف جديد
          </button>
        )}
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}

      {/* Balances Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {balances.map(b => (
          <div key={b.id} className="bg-white p-6 rounded shadow border-t-4 border-blue-600">
            <h3 className="text-gray-500 text-sm font-bold mb-1">{b.name}</h3>
            <div className={`text-3xl font-bold ${b.currentBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {b.currentBalance} <span className="text-sm font-normal text-gray-500">جنية</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-4">
        <button 
          className={`px-4 py-2 font-bold ${activeTab === 'TREASURY' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('TREASURY')}
        >
          حركة الخزينة (الداخل والخارج)
        </button>
        <button 
          className={`px-4 py-2 font-bold ${activeTab === 'EXPENSES' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('EXPENSES')}
        >
          سجل المصروفات
        </button>
      </div>

      {activeTab === 'TREASURY' && (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border-b">التاريخ</th>
                <th className="p-3 border-b">الخزينة</th>
                <th className="p-3 border-b">النوع</th>
                <th className="p-3 border-b">المبلغ</th>
                <th className="p-3 border-b">البيان</th>
                <th className="p-3 border-b">المستخدم</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && <tr><td colSpan="6" className="p-4 text-center text-gray-500">لا توجد حركات</td></tr>}
              {transactions.map(t => (
                <tr key={t.id}>
                  <td className="p-3 border-b">{new Date(t.createdAt).toLocaleString('ar-EG')}</td>
                  <td className="p-3 border-b">{t.paymentMethod.name}</td>
                  <td className="p-3 border-b">
                    <span className={`px-2 py-1 rounded text-xs ${t.type === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {t.type === 'IN' ? 'وارد (+)' : 'منصرف (-)'}
                    </span>
                  </td>
                  <td className="p-3 border-b font-bold">{t.amount}</td>
                  <td className="p-3 border-b">{t.description}</td>
                  <td className="p-3 border-b">{t.user.fullName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'EXPENSES' && (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-3 border-b">التاريخ</th>
                <th className="p-3 border-b">البند (التصنيف)</th>
                <th className="p-3 border-b">المبلغ</th>
                <th className="p-3 border-b">طريقة الدفع</th>
                <th className="p-3 border-b">التفاصيل</th>
                <th className="p-3 border-b">المستخدم</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && <tr><td colSpan="6" className="p-4 text-center text-gray-500">لا توجد مصروفات</td></tr>}
              {expenses.map(e => (
                <tr key={e.id}>
                  <td className="p-3 border-b">{new Date(e.createdAt).toLocaleString('ar-EG')}</td>
                  <td className="p-3 border-b font-bold">{e.category.name}</td>
                  <td className="p-3 border-b font-bold text-red-600">{e.amount}</td>
                  <td className="p-3 border-b">{e.paymentMethod.name}</td>
                  <td className="p-3 border-b">{e.description || '-'}</td>
                  <td className="p-3 border-b">{e.user.fullName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">سحب مصروف جديد</h3>
            <form onSubmit={handleExpenseSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block mb-1 text-sm font-bold">بند المصروف</label>
                <select required className="w-full border rounded p-2" value={expenseForm.categoryId} onChange={e=>setExpenseForm({...expenseForm, categoryId: e.target.value})}>
                  <option value="">اختر التصنيف...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold">المبلغ</label>
                <input required type="number" step="0.01" min="0.01" className="w-full border rounded p-2" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm, amount: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold">الخزينة (طريقة الدفع)</label>
                <select required className="w-full border rounded p-2" value={expenseForm.paymentMethodId} onChange={e=>setExpenseForm({...expenseForm, paymentMethodId: e.target.value})}>
                  <option value="">اختر الخزينة...</option>
                  {balances.map(b => <option key={b.id} value={b.id}>{b.name} (رصيد: {b.currentBalance})</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-bold">تفاصيل / بيان</label>
                <textarea className="w-full border rounded p-2" value={expenseForm.description} onChange={e=>setExpenseForm({...expenseForm, description: e.target.value})}></textarea>
              </div>
              
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">تأكيد الخصم</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TreasuryPage;
