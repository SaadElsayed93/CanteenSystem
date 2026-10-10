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
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await client.patch(`/purchases/suppliers/${id}/status`, { isActive: !currentStatus });
      fetchSuppliers();
    } catch (err) {
      alert('فشل في تحديث الحالة');
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">إدارة الموردين</h2>
        {hasPermission('MANAGE_PURCHASES') && (
          <div className="flex gap-2">
            <Link to="/purchases/new" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
              + فاتورة مشتريات جديدة
            </Link>
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              + إضافة مورد جديد
            </button>
          </div>
        )}
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 border-b">اسم المورد</th>
              <th className="p-3 border-b">العنوان/التليفون</th>
              <th className="p-3 border-b">المديونية (له)</th>
              <th className="p-3 border-b">ملاحظات</th>
              <th className="p-3 border-b">الحالة</th>
              <th className="p-3 border-b">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map(s => (
              <tr key={s.id} className={!s.isActive ? 'bg-gray-50 opacity-60' : ''}>
                <td className="p-3 border-b font-bold">{s.name}</td>
                <td className="p-3 border-b text-sm text-gray-600">{s.address || '-'}</td>
                <td className="p-3 border-b font-bold text-red-600">{s.totalDebt}</td>
                <td className="p-3 border-b text-sm">{s.notes || '-'}</td>
                <td className="p-3 border-b">
                  <span className={`px-2 py-1 rounded text-sm ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {s.isActive ? 'نشط' : 'معطل'}
                  </span>
                </td>
                <td className="p-3 border-b">
                  {hasPermission('MANAGE_PURCHASES') && (
                    <button onClick={() => toggleStatus(s.id, s.isActive)} className="text-blue-600 hover:underline">
                      {s.isActive ? 'تعطيل التعامل' : 'تفعيل'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {suppliers.length === 0 && (
              <tr><td colSpan="6" className="p-4 text-center text-gray-500">لا يوجد موردين</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">إضافة مورد جديد</h3>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block mb-1">اسم المورد</label>
                <input required type="text" className="w-full border rounded p-2" value={form.name} onChange={e=>setForm({...form, name: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-1">العنوان أو التليفون</label>
                <input type="text" className="w-full border rounded p-2" value={form.address} onChange={e=>setForm({...form, address: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-1">ملاحظات</label>
                <textarea className="w-full border rounded p-2" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})}></textarea>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">إلغاء</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">حفظ المورد</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersPage;
