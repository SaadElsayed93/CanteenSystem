import toast from 'react-hot-toast';
import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { Key, Edit, Shield, UserPlus, X, Lock, CheckCircle2 } from 'lucide-react';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add User State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', fullName: '', roleId: '' });

  // Edit User State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: null, fullName: '', username: '', roleId: '' });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Password Reset State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

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
      toast.error(err.response?.data?.message || 'حدث خطأ في إضافة المستخدم');
    }
  };

  const handleOpenEdit = (user) => {
    setEditForm({
      id: user.id,
      fullName: user.fullName || '',
      username: user.username || '',
      roleId: user.role?.id ? String(user.role.id) : (roles[0]?.id ? String(roles[0].id) : '')
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingEdit) return;
    setIsSubmittingEdit(true);
    try {
      await client.put(`/users/${editForm.id}`, {
        fullName: editForm.fullName,
        username: editForm.username,
        roleId: Number(editForm.roleId)
      });
      toast.success('تم تحديث بيانات المستخدم بنجاح');
      setIsEditModalOpen(false);
      fetchUsersAndRoles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تحديث بيانات المستخدم');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleOpenPasswordReset = (user) => {
    setPasswordTargetUser(user);
    setNewPassword('');
    setIsPasswordModalOpen(true);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingPassword) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن لا تقل عن 6 خانات');
      return;
    }
    setIsSubmittingPassword(true);
    try {
      await client.patch(`/users/${passwordTargetUser.id}/password`, {
        password: newPassword
      });
      toast.success(`تم تغيير كلمة المرور للمستخدم (${passwordTargetUser.fullName || passwordTargetUser.username}) بنجاح`);
      setIsPasswordModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل تغيير كلمة المرور');
    } finally {
      setIsSubmittingPassword(false);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="text-indigo-600" size={26} />
            <span>إدارة المستخدمين والصلاحيات 👥</span>
          </h2>
          <p className="text-gray-400 font-bold text-sm mt-1">حسابات الكاشير، المشرفين، كلمات المرور، وصلاحيات النظام</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-indigo-200 flex items-center gap-2"
        >
          <UserPlus size={18} />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
              <tr>
                <th className="p-4 font-bold">الاسم</th>
                <th className="p-4 font-bold">اسم المستخدم (للدخول)</th>
                <th className="p-4 font-bold">الوظيفة (الصلاحيات)</th>
                <th className="p-4 font-bold">الحالة</th>
                <th className="p-4 font-bold">آخر دخول</th>
                <th className="p-4 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.isActive ? 'bg-gray-50 opacity-60' : ''}`}>
                  <td className="p-4 font-bold text-gray-800 text-base">{u.fullName}</td>
                  <td className="p-4 font-mono font-bold text-gray-700">{u.username}</td>
                  <td className="p-4">
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-full text-xs font-bold inline-block">
                      {u.role?.name || 'مستخدم'}
                    </span>
                  </td>
                  <td className="p-4">
                    {u.isActive ? (
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold border border-green-200">نشط</span>
                    ) : (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold border border-red-200">معطل</span>
                    )}
                  </td>
                  <td className="p-4 text-xs font-bold text-gray-500">
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('ar-EG') : 'لم يسجل دخول بعد'}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => handleOpenEdit(u)} 
                        className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1"
                        title="تعديل بيانات المستخدم"
                      >
                        <Edit size={13} />
                        <span>تعديل</span>
                      </button>

                      <button 
                        onClick={() => handleOpenPasswordReset(u)} 
                        className="bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1"
                        title="إعادة تعيين كلمة المرور"
                      >
                        <Key size={13} />
                        <span>كلمة المرور</span>
                      </button>

                      <button 
                        onClick={() => toggleStatus(u.id, u.isActive)} 
                        className={`font-bold text-xs px-3 py-1.5 rounded-lg border transition-all ${
                          u.isActive 
                            ? 'bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 border-gray-200' 
                            : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        }`}
                      >
                        {u.isActive ? 'إيقاف' : 'تفعيل'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-bold">لا يوجد مستخدمين مسجلين</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-md">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <UserPlus className="text-indigo-600" size={22} />
                <span>إضافة مستخدم جديد</span>
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold p-1">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="flex flex-col gap-4">
              <div>
                <label className="block mb-1.5 font-bold text-gray-700 text-xs">الاسم بالكامل</label>
                <input required type="text" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold text-sm" value={form.fullName} onChange={e=>setForm({...form, fullName: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-1.5 font-bold text-gray-700 text-xs">اسم المستخدم (للدخول بالإنجليزية)</label>
                <input required type="text" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold text-sm" dir="ltr" value={form.username} onChange={e=>setForm({...form, username: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-1.5 font-bold text-gray-700 text-xs">كلمة المرور (6 أحرف أو أرقام على الأقل)</label>
                <input required type="password" minLength="6" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold text-sm" value={form.password} onChange={e=>setForm({...form, password: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-1.5 font-bold text-gray-700 text-xs">الصلاحية / الوظيفة</label>
                <select required className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold text-sm bg-white" value={form.roleId} onChange={e=>setForm({...form, roleId: e.target.value})}>
                  <option value="">اختر الصلاحية...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">إنشاء الحساب</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-md">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Edit className="text-amber-600" size={22} />
                <span>تعديل بيانات المستخدم ✏️</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold p-1">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block mb-1.5 font-bold text-gray-700 text-xs">الاسم بالكامل</label>
                <input required type="text" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-500 font-bold text-sm" value={editForm.fullName} onChange={e=>setEditForm({...editForm, fullName: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-1.5 font-bold text-gray-700 text-xs">اسم المستخدم (للدخول)</label>
                <input required type="text" className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-500 font-bold text-sm" dir="ltr" value={editForm.username} onChange={e=>setEditForm({...editForm, username: e.target.value})}/>
              </div>
              <div>
                <label className="block mb-1.5 font-bold text-gray-700 text-xs">الصلاحية / الوظيفة</label>
                <select required className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-amber-500 font-bold text-sm bg-white" value={editForm.roleId} onChange={e=>setEditForm({...editForm, roleId: e.target.value})}>
                  <option value="">اختر الصلاحية...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" disabled={isSubmittingEdit} className="px-6 py-2.5 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200 disabled:opacity-50">
                  {isSubmittingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {isPasswordModalOpen && passwordTargetUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-md">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Key className="text-purple-600" size={22} />
                <span>إعادة تعيين كلمة المرور 🔑</span>
              </h3>
              <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold p-1">
                <X size={20} />
              </button>
            </div>

            <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl mb-4 text-xs font-bold">
              <div className="text-gray-500 mb-1">المستخدم المستهدف:</div>
              <div className="text-purple-900 font-black text-sm">{passwordTargetUser.fullName} ({passwordTargetUser.username})</div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block mb-1.5 font-bold text-gray-700 text-xs">كلمة المرور الجديدة (6 أحرف أو أرقام على الأقل):</label>
                <div className="relative">
                  <input 
                    required 
                    type="password" 
                    minLength="6" 
                    className="w-full border-2 border-gray-200 rounded-xl p-3 outline-none focus:border-purple-500 font-bold text-sm" 
                    placeholder="أدخل كلمة المرور الجديدة..."
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                  />
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">إلغاء</button>
                <button type="submit" disabled={isSubmittingPassword} className="px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200 disabled:opacity-50">
                  {isSubmittingPassword ? 'جاري التحديث...' : 'تأكيد تغيير كلمة المرور'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
