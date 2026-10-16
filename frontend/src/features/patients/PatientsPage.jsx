import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { X, Search } from 'lucide-react';

const PatientsPage = () => {
  const [patients, setPatients] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  const { hasPermission } = useAuth();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ fullName: '', fileNumber: '', internalNumber: '', notes: '', initialBalance: '', paymentMethodId: '' });
  
  const [isTransactModalOpen, setIsTransactModalOpen] = useState(false);
  const [transactForm, setTransactForm] = useState({ patientId: null, type: 'DEPOSIT', amount: '', source: '', description: '', paymentMethodId: '' });
  
  const [statementModal, setStatementModal] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  
  const [activeTab, setActiveTab] = useState('ACTIVE'); // 'ACTIVE' or 'DISCHARGED'
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
  const [dischargeForm, setDischargeForm] = useState({ patient: null, paymentMethodId: '' });

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
  const handleDischargeSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await client.post(`/patients/${dischargeForm.patient.id}/discharge`, { paymentMethodId: dischargeForm.paymentMethodId });
      toast.success('تم تصفية حساب المريض ومغادرته بنجاح');
      setIsDischargeModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في العملية');
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await client.post('/patients', addForm);
      setIsAddModalOpen(false);
      setAddForm({ fullName: '', fileNumber: '', internalNumber: '', notes: '', initialBalance: '', paymentMethodId: '' });
      fetchData();
      setIsSubmitting(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في الإضافة');
      setIsSubmitting(false);
    }
  };

  const handleTransactSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await client.post('/patients/transaction', {
        ...transactForm,
        paymentMethodId: transactForm.paymentMethodId ? Number(transactForm.paymentMethodId) : null
      });
      setIsTransactModalOpen(false);
      fetchData();
      setIsSubmitting(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'خطأ في المعاملة');
      setIsSubmitting(false);
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

  const filteredPatients = patients.filter(p => {
    const matchesTab = activeTab === 'ACTIVE' ? p.isActive : !p.isActive;
    const matchesSearch = (p.fullName || '').includes(search) || (p.fileNumber || '').includes(search) || (p.internalNumber || '').includes(search);
    return matchesTab && matchesSearch;
  });

  const toggleStatus = async (id, currentStatus) => {
    try {
      await client.patch(`/patients/${id}/status`, { isActive: !currentStatus });
      fetchData();
    } catch (err) {
      toast.error('خطأ في تغيير الحالة');
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">إدارة المرضى والعملاء 👥</h2>
          <p className="text-gray-500 mt-1">سجل المرضى، حساباتهم، والأرصدة الحالية</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('ACTIVE')} className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'ACTIVE' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>الحاليين</button>
          <button onClick={() => setActiveTab('DISCHARGED')} className={`px-6 py-2 rounded-lg font-bold transition-all ${activeTab === 'DISCHARGED' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>المغادرين (أرشيف)</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="بحث بالاسم، رقم الملف، الرقم الداخلي..." 
            className="w-full border-2 border-gray-200 rounded-xl py-3 pr-10 pl-4 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-gray-50 focus:bg-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {activeTab === 'ACTIVE' && (
          <button onClick={() => setIsAddModalOpen(true)} className="w-full md:w-auto bg-indigo-600 text-white font-bold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center justify-center gap-2">
            <span className="text-xl leading-none">+</span>
            إضافة مريض جديد
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 border-b font-bold">اسم المريض</th>
                <th className="p-4 border-b font-bold">رقم الملف</th>
                <th className="p-4 border-b font-bold">الرقم الداخلي</th>
                <th className="p-4 border-b font-bold">الرصيد المتاح</th>
                <th className="p-4 border-b font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {filteredPatients.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors bg-white">
                  <td className="p-4 border-b font-bold text-gray-800">{p.fullName}</td>
                  <td className="p-4 border-b font-bold">{p.fileNumber}</td>
                  <td className="p-4 border-b font-bold">{p.internalNumber}</td>
                  <td className="p-4 border-b">
                    <span className={`px-4 py-1.5 rounded-lg font-bold text-sm ${p.currentDebt > 0 ? 'bg-green-100 text-green-700' : p.currentDebt < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {p.currentDebt}
                    </span>
                  </td>
                  <td className="p-4 border-b flex gap-2 justify-center">
                    <button onClick={() => viewStatement(p.id)} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 font-bold transition-colors">كشف حساب</button>
                    {p.isActive ? (
                      <>
                        <button onClick={() => { setTransactForm({ ...transactForm, patientId: p.id }); setIsTransactModalOpen(true); }} className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg hover:bg-green-200 font-bold transition-colors">إيداع / سحب</button>
                        <button onClick={() => { setDischargeForm({ patient: p, paymentMethodId: '' }); setIsDischargeModalOpen(true); }} className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 font-bold transition-colors">مغادرة وتصفية</button>
                      </>
                    ) : (
                      <button onClick={() => toggleStatus(p.id, p.isActive)} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 font-bold transition-colors text-sm">
                        إعادة تفعيل
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredPatients.length === 0 && (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400 font-bold">
                    لا يوجد مرضى مطابقين للبحث أو الفلتر
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-black text-gray-800">إضافة مريض جديد</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">اسم المريض رباعي</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-gray-50 focus:bg-white" value={addForm.fullName} onChange={e=>setAddForm({...addForm, fullName: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">رقم الملف</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-gray-50 focus:bg-white" value={addForm.fileNumber} onChange={e=>setAddForm({...addForm, fileNumber: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الرقم الداخلي (السرير)</label>
                <input required type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-gray-50 focus:bg-white" value={addForm.internalNumber} onChange={e=>setAddForm({...addForm, internalNumber: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الرصيد الافتتاحي (ديبوزت)</label>
                <input type="number" min="0" step="1" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-indigo-700 bg-gray-50 focus:bg-white" value={addForm.initialBalance} onChange={e=>setAddForm({...addForm, initialBalance: e.target.value})} placeholder="مثال: 1000" />
              </div>
              {addForm.initialBalance > 0 && (
                <div>
                  <label className="block mb-2 font-bold text-gray-700 text-sm">إيداع الديبوزت في (الخزينة):</label>
                  <select required className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={addForm.paymentMethodId} onChange={e=>setAddForm({...addForm, paymentMethodId: e.target.value})}>
                    <option value="">-- اختر الخزينة --</option>
                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">ملاحظات (اختياري)</label>
                <textarea className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-gray-50 focus:bg-white" value={addForm.notes} onChange={e=>setAddForm({...addForm, notes: e.target.value})}></textarea>
              </div>
              
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50">حفظ المريض</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isTransactModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <h3 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2">💰 معاملة مالية لمريض</h3>
            
            <form onSubmit={handleTransactSubmit} className="space-y-4">
              <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl">
                <button type="button" onClick={() => setTransactForm({...transactForm, type: 'DEPOSIT'})} className={`flex-1 py-2 font-bold rounded-lg transition-all ${transactForm.type === 'DEPOSIT' ? 'bg-green-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>إيداع نقدي (له)</button>
                <button type="button" onClick={() => setTransactForm({...transactForm, type: 'WITHDRAWAL'})} className={`flex-1 py-2 font-bold rounded-lg transition-all ${transactForm.type === 'WITHDRAWAL' ? 'bg-red-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>سحب نقدي (عليه)</button>
              </div>
              
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">المبلغ</label>
                <input required type="number" min="1" step="0.01" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-lg bg-gray-50 focus:bg-white" value={transactForm.amount} onChange={e=>setTransactForm({...transactForm, amount: e.target.value})} placeholder="0.00" />
              </div>
              
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الخزينة المرتبطة (اختياري)</label>
                <select className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={transactForm.paymentMethodId} onChange={e=>setTransactForm({...transactForm, paymentMethodId: e.target.value})}>
                  <option value="">-- بدون تأثير على الخزينة --</option>
                  {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name} (المتاح: {m.currentBalance})</option>)}
                </select>
                <p className="text-xs text-gray-400 font-bold mt-1">اذا تم الاختيار، سيتم تحديث رصيد هذه الخزينة فوراً.</p>
              </div>
              
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">مصدر الدخل / الوصف (اختياري)</label>
                <input type="text" className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-gray-50 focus:bg-white" value={transactForm.description} onChange={e=>setTransactForm({...transactForm, description: e.target.value})} placeholder="مثال: خصم لغياب، إيداع مقدم..." />
              </div>
              
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsTransactModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className={`px-6 py-2.5 text-white font-bold rounded-xl transition-colors shadow-lg disabled:opacity-50 ${transactForm.type === 'DEPOSIT' ? 'bg-green-600 hover:bg-green-700 shadow-green-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}>تأكيد المعاملة</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {statementModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
              <div>
                <h3 className="text-2xl font-black text-gray-800">كشف حساب المريض</h3>
                <p className="text-indigo-600 font-bold mt-1">{statementModal.fullName} (كود: {statementModal.fileNumber})</p>
              </div>
              <button onClick={() => setStatementModal(null)} className="text-gray-400 hover:text-red-500 transition-colors bg-gray-50 hover:bg-red-50 p-2 rounded-xl">
                <X size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className={`p-4 rounded-xl border-2 ${statementModal.currentDebt > 0 ? 'bg-green-50 border-green-200' : statementModal.currentDebt < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="text-sm font-bold text-gray-500 mb-1">الرصيد المتاح الحالي</div>
                <div className={`text-3xl font-black ${statementModal.currentDebt > 0 ? 'text-green-700' : statementModal.currentDebt < 0 ? 'text-red-700' : 'text-gray-700'}`}>
                  {statementModal.currentDebt} جنية
                </div>
              </div>
              <div className="p-4 rounded-xl border-2 border-indigo-100 bg-indigo-50 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-gray-500 mb-1">إجمالي الحركات</div>
                  <div className="text-xl font-bold text-indigo-900">{statementModal.transactions?.length || 0} حركة مالية</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-500 mb-1">فواتير مسحوبات المريض</div>
                  <div className="text-xl font-bold text-indigo-900">{statementModal.invoices?.length || 0} فاتورة</div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-6">
              <div>
                <h4 className="font-black text-gray-800 mb-3 border-b-2 border-indigo-100 inline-block pb-1">سجل الحركات المالية</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 border-b font-bold text-gray-600">التاريخ</th>
                        <th className="p-3 border-b font-bold text-gray-600">النوع</th>
                        <th className="p-3 border-b font-bold text-gray-600">المبلغ</th>
                        <th className="p-3 border-b font-bold text-gray-600">المصدر / البيان</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementModal.transactions?.length === 0 ? (
                        <tr><td colSpan="4" className="p-6 text-center text-gray-400 font-bold">لا توجد حركات مسجلة</td></tr>
                      ) : (
                        statementModal.transactions?.map(tx => (
                          <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-3 border-b text-gray-600 font-bold" dir="ltr">{new Date(tx.createdAt).toLocaleString('ar-EG')}</td>
                            <td className="p-3 border-b">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${tx.type === 'DEPOSIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {tx.type === 'DEPOSIT' ? 'إيداع (سداد)' : 'سحب (مديونية)'}
                              </span>
                            </td>
                            <td className={`p-3 border-b font-bold ${tx.type === 'DEPOSIT' ? 'text-green-600' : 'text-red-600'}`}>
                              {tx.amount}
                            </td>
                            <td className="p-3 border-b text-gray-600 font-bold">{tx.description || tx.source}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="font-black text-gray-800 mb-3 border-b-2 border-indigo-100 inline-block pb-1">أحدث فواتير مسحوبات المريض المسحوبة</h4>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right border-collapse text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-3 border-b font-bold text-gray-600">التاريخ</th>
                        <th className="p-3 border-b font-bold text-gray-600">رقم الفاتورة</th>
                        <th className="p-3 border-b font-bold text-gray-600">الإجمالي</th>
                        <th className="p-3 border-b font-bold text-gray-600 text-center">التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statementModal.invoices?.length === 0 ? (
                        <tr><td colSpan="4" className="p-6 text-center text-gray-400 font-bold">لا توجد فواتير</td></tr>
                      ) : (
                        statementModal.invoices?.map(inv => (
                          <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-3 border-b text-gray-600 font-bold" dir="ltr">{new Date(inv.createdAt).toLocaleString('ar-EG')}</td>
                            <td className="p-3 border-b font-bold text-gray-800">{inv.invoiceNumber}</td>
                            <td className="p-3 border-b font-bold text-red-600">{inv.totalAmount}</td>
                            <td className="p-3 border-b text-center">
                              <button onClick={() => {
                                client.get(`/sales/invoices/${inv.id}`).then(res => setSelectedInvoice(res.data.data)).catch(console.error);
                              }} className="text-indigo-600 hover:text-indigo-800 font-bold underline text-xs bg-indigo-50 px-2 py-1 rounded">عرض التفاصيل</button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setStatementModal(null)} className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">إغلاق الكشف</button>
            </div>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-4">
              <h3 className="text-xl font-black text-gray-800">تفاصيل الفاتورة ({selectedInvoice.invoiceNumber})</h3>
              <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-red-500">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2">
              <table className="w-full text-right border-collapse text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 border-b font-bold text-gray-600">الصنف</th>
                    <th className="p-3 border-b font-bold text-gray-600 text-center">الكمية</th>
                    <th className="p-3 border-b font-bold text-gray-600">السعر</th>
                    <th className="p-3 border-b font-bold text-gray-600">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedInvoice.items?.map(item => (
                    <tr key={item.id} className="border-b">
                      <td className="p-3 font-bold">{item.product?.name}</td>
                      <td className="p-3 text-center font-bold">{item.quantity}</td>
                      <td className="p-3">{item.unitPrice}</td>
                      <td className="p-3 font-bold text-indigo-700">{item.subtotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
              <span className="font-bold text-gray-600">إجمالي الفاتورة:</span>
              <span className="text-2xl font-black text-indigo-700">{selectedInvoice.totalAmount} جنية</span>
            </div>
          </div>
        </div>
      )}

      {isDischargeModalOpen && dischargeForm.patient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <h3 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-2">🚪 مغادرة وتصفية حساب</h3>
            <p className="text-gray-600 mb-4 font-bold">هل أنت متأكد من مغادرة المريض <span className="text-indigo-700">{dischargeForm.patient.fullName}</span>؟</p>
            
            <div className={`p-4 rounded-xl border-2 mb-6 ${dischargeForm.patient.currentDebt > 0 ? 'bg-red-50 border-red-200 text-red-800' : dischargeForm.patient.currentDebt < 0 ? 'bg-green-50 border-green-200 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-800'}`}>
              <div className="text-sm font-bold opacity-80 mb-1">الرصيد الحالي:</div>
              <div className="text-3xl font-black mb-2">
                {Math.abs(dischargeForm.patient.currentDebt)} جنية
              </div>
              <div className="text-sm font-bold">
                {dischargeForm.patient.currentDebt > 0 ? '⚠️ للمريض رصيد متبقي، سيتم رده له (سحب من الخزينة).' : dischargeForm.patient.currentDebt < 0 ? '💰 على المريض ديون، سيتم تحصيلها منه (إيداع في الخزينة).' : '✅ الحساب مصفر، لا توجد معاملات مالية.'}
              </div>
            </div>

            <form onSubmit={handleDischargeSubmit}>
              {dischargeForm.patient.currentDebt !== 0 && (
                <div className="mb-6">
                  <label className="block mb-2 font-bold text-gray-700 text-sm">اختر الخزينة لتسوية الحساب:</label>
                  <select required className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white" value={dischargeForm.paymentMethodId} onChange={e => setDischargeForm({...dischargeForm, paymentMethodId: e.target.value})}>
                    <option value="">-- اختر الخزينة --</option>
                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name} (المتاح: {m.currentBalance})</option>)}
                  </select>
                </div>
              )}
              
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsDischargeModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50">تأكيد المغادرة</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientsPage;
