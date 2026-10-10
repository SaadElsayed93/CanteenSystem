import toast from 'react-hot-toast';
import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import { useAuth } from '../auth/AuthContext';
import { Link } from 'react-router-dom';

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { hasPermission } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', notes: '' });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await client.get('/purchases/suppliers');
      setSuppliers(res.data.data);
    } catch (err) {
      setError('فشل في جلب بيانات الموردين');
    } finally {
      setLoading(false);
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

  if (loading) return <div className="text-center mt-10 font-bold text-gray-500">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">إدارة الموردين 🏢</h2>
        {hasPermission('MANAGE_PURCHASES') && (
          <div className="flex gap-3">
            <Link to="/purchases/new" className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
              + فاتورة مشتريات جديدة
            </Link>
            <button onClick={() => setIsModalOpen(true)} className="bg-white text-indigo-600 border-2 border-indigo-600 font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-50 transition-all shadow-sm">
              + إضافة مورد جديد
            </button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-4 rounded-xl font-bold">{error}</div>}

      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 border-b font-bold">اسم المورد</th>
                <th className="p-4 border-b font-bold">العنوان/التليفون</th>
                <th className="p-4 border-b font-bold">المديونية (له)</th>
                <th className="p-4 border-b font-bold">ملاحظات</th>
                <th className="p-4 border-b font-bold">الحالة</th>
                <th className="p-4 border-b font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {suppliers.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${!s.isActive ? 'bg-gray-50 opacity-60' : ''}`}>
                  <td className="p-4 border-b font-bold text-gray-800">{s.name}</td>
                  <td className="p-4 border-b text-sm">{s.address || '-'}</td>
                  <td className="p-4 border-b font-bold text-red-600">{s.totalDebt}</td>
                  <td className="p-4 border-b text-sm">{s.notes || '-'}</td>
                  <td className="p-4 border-b">
                    {s.isActive ? (
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold border border-green-200">نشط</span>
                    ) : (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold border border-red-200">معطل</span>
                    )}
                  </td>
                  <td className="p-4 border-b">
                    {hasPermission('MANAGE_PURCHASES') && (
                      <button onClick={() => toggleStatus(s.id, s.isActive)} className={`font-bold transition-all hover:underline ${s.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}>
                        {s.isActive ? 'إيقاف التعامل' : 'تفعيل'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-bold">لا يوجد موردين مسجلين حتى الآن</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <h3 className="text-2xl font-bold mb-6 text-gray-800 border-b border-gray-100 pb-4">🏢 إضافة مورد جديد</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">اسم المورد</label>
                <input required type="text" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.name} onChange={e=>setForm({...form, name: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">العنوان أو التليفون (اختياري)</label>
                <input type="text" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.address} onChange={e=>setForm({...form, address: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">ملاحظات (اختياري)</label>
                <textarea className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[100px]" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">حفظ المورد</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
