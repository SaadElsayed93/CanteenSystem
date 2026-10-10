import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import toast from 'react-hot-toast';

const actionMap = {
  'CREATE': { label: 'إضافة جديدة', color: 'bg-green-100 text-green-800 border-green-200' },
  'UPDATE': { label: 'تعديل بيانات', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'DELETE': { label: 'حذف', color: 'bg-red-100 text-red-800 border-red-200' },
  'LOGIN': { label: 'تسجيل دخول', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  'SALE': { label: 'عملية بيع', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  'ADJUST': { label: 'تسوية مخزون', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'PURCHASE': { label: 'عملية شراء', color: 'bg-teal-100 text-teal-800 border-teal-200' }
};

const entityMap = {
  'PRODUCT': 'الأصناف',
  'INVOICE': 'فواتير المبيعات',
  'USER': 'المستخدمين',
  'SUPPLIER': 'الموردين',
  'PURCHASE': 'فواتير المشتريات',
  'PATIENT': 'المرضى/العملاء',
  'SYSTEM': 'النظام'
};

const HistoryPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await client.get('/audit-logs');
      setLogs(res.data.data);
    } catch (err) {
      toast.error('فشل جلب سجل الحركات');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center mt-10 font-bold text-gray-500">جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border-2 border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">سجل الحركات (History) 📜</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-4 border-b font-bold w-48">التاريخ والوقت</th>
                <th className="p-4 border-b font-bold">المستخدم</th>
                <th className="p-4 border-b font-bold">نوع الحركة</th>
                <th className="p-4 border-b font-bold">القسم</th>
                <th className="p-4 border-b font-bold">التفاصيل (التغيرات)</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              {logs.map(log => {
                const actionInfo = actionMap[log.action] || { label: log.action, color: 'bg-gray-100 text-gray-800 border-gray-200' };
                const entityName = entityMap[log.entityType] || log.entityType;
                
                return (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 border-b text-sm font-bold text-gray-500">
                      {new Date(log.createdAt).toLocaleString('ar-EG')}
                    </td>
                    <td className="p-4 border-b font-bold text-gray-800">
                      {log.user?.fullName || log.user?.username || 'مجهول'}
                    </td>
                    <td className="p-4 border-b">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${actionInfo.color}`}>
                        {actionInfo.label}
                      </span>
                    </td>
                    <td className="p-4 border-b font-bold text-gray-700">
                      {entityName}
                    </td>
                    <td className="p-4 border-b text-sm">
                      {log.newValues ? (
                        <div className="bg-gray-50 p-2 rounded border border-gray-100 font-mono text-xs overflow-x-auto max-w-xs">
                          {log.newValues}
                        </div>
                      ) : (
                        <span className="text-gray-400">لا توجد تفاصيل</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400 font-bold">لا توجد حركات مسجلة حتى الآن</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
