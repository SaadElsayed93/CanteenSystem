import toast from 'react-hot-toast';
import React, { useEffect, useState } from 'react';
import client from '../../api/client';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', roleId: '' });

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const fetchUsersAndRoles = async () => {
    try {
      const [uRes, rRes] = await Promise.all([
        client.get('/users'),
        client.get('/users/roles')
      ]);
      setUsers(uRes.data.data);
      setRoles(rRes.data.data);
    } catch (err) {
      toast.error('فشل جلب المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await client.post('/users', {
        ...form,
        roleId: Number(form.roleId)
      });
      setIsModalOpen(false);
      setForm({ username: '', password: '', fullName: '', roleId: '' });
      fetchUsersAndRoles();
      toast.success('تمت إضافة المستخدم بنجاح');
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await client.patch(`/users/${id}/status`, { isActive: !currentStatus });
      fetchUsersAndRoles();
      toast.success('تم تحديث حالة المستخدم بنجاح');
    } catch (err) {
      toast.error('فشل تحديث الحالة');
    }
  };

  if (loading) return <div className="text-center mt-10 font-bold text-gray-500">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">إدارة المستخدمين والصلاحيات 👥</h2>
        <button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200">
          + إضافة مستخدم جديد
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 border-b font-bold">الاسم</th>
                <th className="p-4 border-b font-bold">اسم المستخدم (للدخول)</th>
                <th className="p-4 border-b font-bold">الوظيفة (الصلاحيات)</th>
                <th className="p-4 border-b font-bold">الحالة</th>
                <th className="p-4 border-b font-bold">آخر دخول</th>
                <th className="p-4 border-b font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.isActive ? 'bg-gray-50 opacity-60' : ''}`}>
                  <td className="p-4 border-b font-bold text-gray-800">{u.fullName}</td>
                  <td className="p-4 border-b">{u.username}</td>
                  <td className="p-4 border-b font-bold text-indigo-600">{u.role?.name}</td>
                  <td className="p-4 border-b">
                    {u.isActive ? (
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold border border-green-200">نشط</span>
                    ) : (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold border border-red-200">معطل</span>
                    )}
                  </td>
                  <td className="p-4 border-b text-sm">{u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG') : 'لم يسجل دخول'}</td>
                  <td className="p-4 border-b text-center">
                    <button onClick={() => toggleStatus(u.id, u.isActive)} className={`font-bold transition-all hover:underline ${u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}>
                      {u.isActive ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-bold">لا يوجد مستخدمين</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <h3 className="text-2xl font-bold mb-6 text-gray-800 border-b border-gray-100 pb-4">👤 إضافة مستخدم جديد</h3>
            <form onSubmit={handleAddUser} className="flex flex-col gap-5">
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الاسم بالكامل</label>
                <input required type="text" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.fullName} onChange={e=>setForm({...form, fullName: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">اسم المستخدم (للدخول)</label>
                <input required type="text" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.username} onChange={e=>setForm({...form, username: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">كلمة المرور</label>
                <input required type="password" minLength="6" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" value={form.password} onChange={e=>setForm({...form, password: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-2 font-bold text-gray-700 text-sm">الصلاحية / الوظيفة</label>
                <select required className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white" value={form.roleId} onChange={e=>setForm({...form, roleId: e.target.value})}>
                  <option value="">اختر الصلاحية...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">إنشاء الحساب</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
