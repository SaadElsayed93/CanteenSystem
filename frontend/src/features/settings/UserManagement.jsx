import React, { useEffect, useState } from 'react';
import client from '../../api/client';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', roleId: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsersAndRoles();
  }, []);

  const fetchUsersAndRoles = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        client.get('/users'),
        client.get('/users/roles')
      ]);
      setUsers(usersRes.data.data);
      setRoles(rolesRes.data.data);
    } catch (err) {
      setError('فشل في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await client.post('/users', form);
      setSuccess('تم إضافة المستخدم بنجاح');
      setForm({ username: '', password: '', fullName: '', roleId: '' });
      fetchUsersAndRoles();
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء الإضافة');
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await client.patch(`/users/${id}/status`, { isActive: !currentStatus });
      fetchUsersAndRoles();
    } catch (err) {
      alert('فشل تحديث الحالة');
    }
  };

  if (loading) return <div>جاري التحميل...</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">إدارة المستخدمين</h2>
      
      {error && <div className="bg-red-100 text-red-700 p-3 mb-4 rounded">{error}</div>}
      {success && <div className="bg-green-100 text-green-700 p-3 mb-4 rounded">{success}</div>}

      <form onSubmit={handleCreate} className="bg-white p-4 rounded shadow mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1">الاسم الكامل</label>
          <input required type="text" className="w-full border rounded p-2" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
        </div>
        <div>
          <label className="block mb-1">اسم المستخدم</label>
          <input required type="text" className="w-full border rounded p-2" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
        </div>
        <div>
          <label className="block mb-1">كلمة المرور</label>
          <input required type="password" className="w-full border rounded p-2" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
        </div>
        <div>
          <label className="block mb-1">الصلاحية (الدور)</label>
          <select required className="w-full border rounded p-2" value={form.roleId} onChange={e => setForm({...form, roleId: Number(e.target.value)})}>
            <option value="">اختر الصلاحية...</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">إضافة مستخدم</button>
        </div>
      </form>

      <div className="bg-white rounded shadow overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 border-b">الاسم</th>
              <th className="p-3 border-b">اسم المستخدم</th>
              <th className="p-3 border-b">الدور</th>
              <th className="p-3 border-b">آخر ظهور</th>
              <th className="p-3 border-b">الحالة</th>
              <th className="p-3 border-b">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td className="p-3 border-b">{u.fullName}</td>
                <td className="p-3 border-b">{u.username}</td>
                <td className="p-3 border-b">{u.role.name}</td>
                <td className="p-3 border-b">{u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG') : 'لم يسجل الدخول'}</td>
                <td className="p-3 border-b">
                  <span className={`px-2 py-1 rounded text-sm ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {u.isActive ? 'نشط' : 'معطل'}
                  </span>
                </td>
                <td className="p-3 border-b">
                  <button onClick={() => toggleStatus(u.id, u.isActive)} className="text-blue-600 hover:underline">
                    {u.isActive ? 'تعطيل' : 'تفعيل'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
