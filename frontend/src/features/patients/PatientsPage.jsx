import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { X } from 'lucide-react';

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
  const [selectedInvoice, setSelectedInvoice] = useState(null);

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
      toast.error(err.response?.data?.message || 'خطأ في الإضافة');
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
      toast.error(err.response?.data?.message || 'خطأ في المعاملة');
    }
  };

  const viewStatement = async (id) => {
    try {
      const res = await client.get(`/patients/${id}`);
      setStatementModal(res.data.data);
    } catch (err) {
      toast.error('خطأ في جلب الكشف');
    }
  };

  
  const viewInvoice = async (id) => {
    try {
      const res = await client.get(`/sales/invoices/${id}`);
      setSelectedInvoice(res.data.data);
    } catch (err) {
      toast.error('خطأ في جلب تفاصيل الفاتورة');
    }
  };

  const filteredPatients = patients.filter(p => 
    p.fullName.includes(search) || 
    p.fileNumber.includes(search) || 
    p.internalNumber.includes(search)
  );

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">المرضى (الأرصدة)</h2>
        {hasPermission('VIEW_PATIENTS') && (
          <button onClick={() => setIsAddModalOpen(true)} className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
            + إضافة مريض جديد
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-lg font-bold">{error}</div>}

      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <div className="mb-6">
          <input 
            type="text" 
            placeholder="بحث بالاسم، رقم الملف، أو الرقم الداخلي..." 
            className="w-full md:w-1/3 border border-gray-200 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto rounded-xl border-2 border-gray-200">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 border-b font-bold">رقم الملف</th>
                <th className="p-4 border-b font-bold">الاسم</th>
                <th className="p-4 border-b font-bold">الرقم الداخلي</th>
                <th className="p-4 border-b font-bold">الرصيد الحالي</th>
                <th className="p-4 border-b font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {filteredPatients.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4 border-b font-bold text-gray-800">{p.fileNumber}</td>
                  <td className="p-4 border-b font-bold text-gray-800">{p.fullName}</td>
                  <td className="p-4 border-b">{p.internalNumber}</td>
                  <td className={`p-4 border-b font-bold text-lg ${p.currentDebt > 0 ? 'text-green-600' : p.currentDebt < 0 ? 'text-red-600' : ''}`}>
                    {p.currentDebt}
                  </td>
                  <td className="p-4 border-b">
                    <div className="flex gap-4">
                      <button onClick={() => viewStatement(p.id)} className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline transition-all">كشف الحساب</button>
                      {hasPermission('CREATE_DEPOSIT') && (
                        <button onClick={() => {
                          setTransactForm({ patientId: p.id, type: 'DEPOSIT', amount: '', source: '', description: '', paymentMethodId: '' });
                          setIsTransactModalOpen(true);
                        }} className="text-emerald-600 hover:text-emerald-800 font-bold hover:underline transition-all">معاملة مالية (سداد/جزاء)</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-gray-500">لا توجد بيانات مطابقة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Patient Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b border-gray-100 pb-4">👤 إضافة مريض جديد</h3>
            <form onSubmit={handleAddSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الاسم الرباعي</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={addForm.fullName} onChange={e=>setAddForm({...addForm, fullName: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">رقم الملف الطبي</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={addForm.fileNumber} onChange={e=>setAddForm({...addForm, fileNumber: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الرقم الداخلي</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={addForm.internalNumber} onChange={e=>setAddForm({...addForm, internalNumber: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">ملاحظات (اختياري)</label>
                <textarea className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={addForm.notes} onChange={e=>setAddForm({...addForm, notes: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">حفظ المريض</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {isTransactModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b border-gray-100 pb-4">💰 معاملة مالية (سداد / سحب)</h3>
            <form onSubmit={handleTransactSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">نوع المعاملة:</label>
                <select className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={transactForm.type} onChange={e=>setTransactForm({...transactForm, type: e.target.value})}>
                  <option value="DEPOSIT">إيداع في حساب المريض (الرصيد يزيد)</option>
                  <option value="WITHDRAWAL">خصم فلوس من المريض (خصم أو جزاء، الرصيد يقل)</option>
                </select>
                {transactForm.type === 'DEPOSIT' ? (
                  <p className="text-xs text-green-600 mt-2 font-bold bg-green-50 p-2 rounded-lg border border-green-100">💡 رصيد المريض سيزيد. (وإذا اخترت خزينة، سيتم إيداع المبلغ فيها).</p>
                ) : (
                  <p className="text-xs text-red-600 mt-2 font-bold bg-red-50 p-2 rounded-lg border border-red-100">💡 رصيد المريض سيقل. (وإذا اخترت خزينة، سيتم سحب المبلغ منها).</p>
                )}
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">المبلغ:</label>
                <input required type="number" step="0.01" min="0.01" placeholder="مثال: 100" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-indigo-700" value={transactForm.amount} onChange={e=>setTransactForm({...transactForm, amount: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الخزينة المرتبطة (اختياري):</label>
                <select className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={transactForm.paymentMethodId} onChange={e=>setTransactForm({...transactForm, paymentMethodId: e.target.value})}>
                  <option value="">-- بدون خزينة (تعديل رصيد فقط) --</option>
                  {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">المصدر / الملاحظات:</label>
                <input type="text" placeholder="مثال: تحويل فودافون كاش من والده" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={transactForm.source} onChange={e=>setTransactForm({...transactForm, source: e.target.value})}/>
              </div>
              
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsTransactModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" className={`px-6 py-2.5 text-white font-bold rounded-xl transition-colors shadow-lg ${transactForm.type === 'DEPOSIT' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}>تأكيد المعاملة</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statement Modal */}
      {statementModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-2xl font-bold text-gray-800">📄 كشف حساب: <span className="text-indigo-700">{statementModal.fullName}</span></h3>
              <button onClick={() => setStatementModal(null)} className="text-gray-400 hover:text-red-500 bg-gray-100 hover:bg-red-50 w-10 h-10 rounded-full flex items-center justify-center transition-all font-bold text-xl">×</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 bg-indigo-50 p-6 rounded-xl border border-indigo-100">
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-xs text-gray-500 mb-1">رقم الملف</div>
                <div className="font-bold text-gray-800">{statementModal.fileNumber}</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm">
                <div className="text-xs text-gray-500 mb-1">الرقم الداخلي</div>
                <div className="font-bold text-gray-800">{statementModal.internalNumber}</div>
              </div>
              <div className="bg-white p-3 rounded-lg shadow-sm border border-indigo-50">
                <div className="text-xs text-gray-500 mb-1">الرصيد الحالي</div>
                <div className={`font-bold text-xl ${statementModal.currentDebt > 0 ? 'text-green-600' : statementModal.currentDebt < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {statementModal.currentDebt}
                </div>
              </div>
            </div>

            <h4 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><span>💵</span> حركات السداد والإيداع</h4>
            <div className="overflow-hidden rounded-xl border border-gray-200 mb-8 shadow-sm">
              <table className="w-full text-right border-collapse text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="p-4 border-b font-bold">التاريخ</th>
                    <th className="p-4 border-b font-bold">النوع</th>
                    <th className="p-4 border-b font-bold">المبلغ</th>
                    <th className="p-4 border-b font-bold">المصدر</th>
                    <th className="p-4 border-b font-bold">البيان</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  {statementModal.transactions.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-gray-500 bg-white">لا توجد حركات مالية</td></tr>}
                  {statementModal.transactions.map(t => (
                    <tr key={t.id} className="bg-white hover:bg-gray-50 transition-colors">
                      <td className="p-4 border-b">{new Date(t.createdAt).toLocaleString('ar-EG')}</td>
                      <td className="p-4 border-b">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${t.type === 'DEPOSIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {t.type === 'DEPOSIT' ? 'إيداع/سداد' : 'سحب/خصم'}
                        </span>
                      </td>
                      <td className={`p-4 border-b font-bold ${t.type === 'DEPOSIT' ? 'text-green-600' : 'text-red-600'}`}>{t.amount}</td>
                      <td className="p-4 border-b">{t.source || '-'}</td>
                      <td className="p-4 border-b">{t.description || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h4 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2"><span>🛍️</span> آخر فواتير المشتريات من الكانتين</h4>
            <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
              <table className="w-full text-right border-collapse text-sm">
                <thead className="bg-gray-50 text-gray-700">
                  <tr>
                    <th className="p-4 border-b font-bold">رقم الفاتورة</th>
                    <th className="p-4 border-b font-bold">التاريخ</th>
                    <th className="p-4 border-b font-bold">المبلغ الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="text-gray-600">
                  {statementModal.invoices.length === 0 && <tr><td colSpan="3" className="p-8 text-center text-gray-500 bg-white">لا توجد مسحوبات</td></tr>}
                  {statementModal.invoices.map(inv => (
                    <tr key={inv.id} onClick={() => viewInvoice(inv.id)} className="bg-white hover:bg-indigo-50 transition-colors cursor-pointer group">
                      <td className="p-4 border-b font-bold text-indigo-600 group-hover:underline">{inv.invoiceNumber} (عرض)</td>
                      <td className="p-4 border-b">{new Date(inv.createdAt).toLocaleString('ar-EG')}</td>
                      <td className="p-4 border-b font-bold text-red-600">{inv.totalAmount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <h3 className="text-2xl font-bold text-gray-800">
                تفاصيل فاتورة المبيعات #{selectedInvoice.id}
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
            </div>

            <h4 className="font-bold text-gray-700 mb-3">الأصناف المطلوبة:</h4>
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

            <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <span className="font-bold text-indigo-900 text-lg">إجمالي الفاتورة:</span>
              <span className="font-black text-2xl text-indigo-700">{selectedInvoice.totalAmount} جنية</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PatientsPage;


