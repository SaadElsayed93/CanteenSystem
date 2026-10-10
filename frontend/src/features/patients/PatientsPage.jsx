import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';

const PatientsPage = () => {
  const [patients, setPatients] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  const { hasPermission } = useAuth();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', fileNumber: '', internalNumber: '', notes: '' });
  
  const [isTransactModalOpen, setIsTransactModalOpen] = useState(false);
  const [transactForm, setTransactForm] = useState({ patientId: null, type: 'DEPOSIT', amount: '', source: '', description: '', paymentMethodId: '' });
  
  const [statementModal, setStatementModal] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [patRes, pmRes] = await Promise.all([
        client.get('/patients'),
        client.get('/sales/pos-data') // we can get payment methods from here for now
      ]);
      setPatients(patRes.data.data);
      setPaymentMethods(pmRes.data.data.paymentMethods);
    } catch (err) {
      setError('فشل جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post('/patients', addForm);
      setIsAddModalOpen(false);
      setAddForm({ fullName: '', fileNumber: '', internalNumber: '', notes: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'خطأ في الإضافة');
    }
  };

  const handleTransactSubmit = async (e) => {
    e.preventDefault();
    try {
      await client.post('/patients/transaction', {
        ...transactForm,
        paymentMethodId: transactForm.paymentMethodId ? Number(transactForm.paymentMethodId) : null
      });
      setIsTransactModalOpen(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'خطأ في المعاملة');
    }
  };

  const viewStatement = async (id) => {
    try {
      const res = await client.get(`/patients/${id}`);
      setStatementModal(res.data.data);
    } catch (err) {
      alert('خطأ في جلب الكشف');
    }
  };

  const filteredPatients = patients.filter(p => 
    p.fullName.includes(search) || 
    p.fileNumber.includes(search) || 
    p.internalNumber.includes(search)
  );

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">المرضى (الحسابات والديون)</h2>
        {hasPermission('VIEW_PATIENTS') && (
          <button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            + إضافة مريض جديد
          </button>
        )}
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}

      <div className="mb-4">
        <input 
          type="text" 
          placeholder="بحث بالاسم، رقم الملف، أو الرقم الداخلي..." 
          className="w-full md:w-1/3 border rounded p-2"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 border-b">رقم الملف</th>
              <th className="p-3 border-b">الاسم</th>
              <th className="p-3 border-b">الرقم الداخلي</th>
              <th className="p-3 border-b">المديونية الحالية</th>
              <th className="p-3 border-b">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredPatients.map(p => (
              <tr key={p.id}>
                <td className="p-3 border-b font-bold">{p.fileNumber}</td>
                <td className="p-3 border-b">{p.fullName}</td>
                <td className="p-3 border-b">{p.internalNumber}</td>
                <td className={`p-3 border-b font-bold ${p.currentDebt > 0 ? 'text-red-600' : p.currentDebt < 0 ? 'text-green-600' : ''}`}>
                  {p.currentDebt}
                </td>
                <td className="p-3 border-b flex gap-2">
                  <button onClick={() => viewStatement(p.id)} className="text-blue-600 hover:underline">كشف الحساب</button>
                  {hasPermission('CREATE_DEPOSIT') && (
                    <button onClick={() => {
                      setTransactForm({ patientId: p.id, type: 'DEPOSIT', amount: '', source: '', description: '', paymentMethodId: '' });
                      setIsTransactModalOpen(true);
                    }} className="text-green-600 hover:underline">إيداع/سداد</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Patient Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">إضافة مريض جديد</h3>
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-4">
              <input required type="text" placeholder="الاسم الرباعي" className="border p-2 rounded" value={addForm.fullName} onChange={e=>setAddForm({...addForm, fullName: e.target.value})}/>
              <input required type="text" placeholder="رقم الملف الطبي" className="border p-2 rounded" value={addForm.fileNumber} onChange={e=>setAddForm({...addForm, fileNumber: e.target.value})}/>
              <input required type="text" placeholder="الرقم الداخلي" className="border p-2 rounded" value={addForm.internalNumber} onChange={e=>setAddForm({...addForm, internalNumber: e.target.value})}/>
              <textarea placeholder="ملاحظات" className="border p-2 rounded" value={addForm.notes} onChange={e=>setAddForm({...addForm, notes: e.target.value})}></textarea>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">حفظ</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isTransactModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">معاملة مالية (سداد / سحب)</h3>
            <form onSubmit={handleTransactSubmit} className="flex flex-col gap-4">
              <select className="border p-2 rounded" value={transactForm.type} onChange={e=>setTransactForm({...transactForm, type: e.target.value})}>
                <option value="DEPOSIT">إيداع / سداد مديونية (نقص الدين)</option>
                <option value="WITHDRAWAL">سحب رصيد (زيادة الدين)</option>
              </select>
              <input required type="number" step="0.01" min="0.01" placeholder="المبلغ" className="border p-2 rounded" value={transactForm.amount} onChange={e=>setTransactForm({...transactForm, amount: e.target.value})}/>
              <input type="text" placeholder="المصدر (مثال: فودافون كاش من والده)" className="border p-2 rounded" value={transactForm.source} onChange={e=>setTransactForm({...transactForm, source: e.target.value})}/>
              <select className="border p-2 rounded" value={transactForm.paymentMethodId} onChange={e=>setTransactForm({...transactForm, paymentMethodId: e.target.value})}>
                <option value="">-- تسميع في الخزينة؟ (اختر الخزينة) --</option>
                {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input type="text" placeholder="البيان/ملاحظات" className="border p-2 rounded" value={transactForm.description} onChange={e=>setTransactForm({...transactForm, description: e.target.value})}/>
              
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsTransactModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">تأكيد</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {statementModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">كشف حساب: {statementModal.fullName}</h3>
              <button onClick={() => setStatementModal(null)} className="text-gray-600 hover:text-red-600 font-bold text-2xl">×</button>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded">
              <div><strong>رقم الملف:</strong> {statementModal.fileNumber}</div>
              <div><strong>الرقم الداخلي:</strong> {statementModal.internalNumber}</div>
              <div>
                <strong>المديونية الحالية:</strong> 
                <span className={`mr-2 font-bold ${statementModal.currentDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {statementModal.currentDebt}
                </span>
              </div>
            </div>

            <h4 className="font-bold mb-2">حركات السداد والإيداع</h4>
            <table className="w-full text-right border-collapse mb-6 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border-b">التاريخ</th>
                  <th className="p-2 border-b">النوع</th>
                  <th className="p-2 border-b">المبلغ</th>
                  <th className="p-2 border-b">المصدر</th>
                  <th className="p-2 border-b">البيان</th>
                </tr>
              </thead>
              <tbody>
                {statementModal.transactions.length === 0 && <tr><td colSpan="5" className="p-2 text-center text-gray-500">لا توجد حركات</td></tr>}
                {statementModal.transactions.map(t => (
                  <tr key={t.id}>
                    <td className="p-2 border-b">{new Date(t.createdAt).toLocaleString('ar-EG')}</td>
                    <td className="p-2 border-b">{t.type === 'DEPOSIT' ? 'سداد/إيداع' : 'سحب'}</td>
                    <td className="p-2 border-b font-bold">{t.amount}</td>
                    <td className="p-2 border-b">{t.source || '-'}</td>
                    <td className="p-2 border-b">{t.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 className="font-bold mb-2">آخر 10 فواتير مشتريات من الكانتين</h4>
            <table className="w-full text-right border-collapse text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border-b">رقم الفاتورة</th>
                  <th className="p-2 border-b">التاريخ</th>
                  <th className="p-2 border-b">المبلغ الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {statementModal.invoices.length === 0 && <tr><td colSpan="3" className="p-2 text-center text-gray-500">لا توجد مسحوبات</td></tr>}
                {statementModal.invoices.map(inv => (
                  <tr key={inv.id}>
                    <td className="p-2 border-b">{inv.invoiceNumber}</td>
                    <td className="p-2 border-b">{new Date(inv.createdAt).toLocaleString('ar-EG')}</td>
                    <td className="p-2 border-b font-bold text-red-600">{inv.totalAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;
