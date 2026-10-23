import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, requiredPermission, disallowAdmin = false, disallowRoles = [] }) => {
  const { user, loading, hasPermission, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">جاري التحميل...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
  const isBlocked = 
    (disallowAdmin && isAdmin) ||
    (disallowRoles.length > 0 && (
      disallowRoles.includes(roleName) || 
      (isAdmin && disallowRoles.some(r => ['أدمن', 'مدير', 'ADMIN'].includes(r)))
    ));

  if (isBlocked) {
    return (
      <div className="p-12 text-center space-y-4 bg-white rounded-3xl m-8 border-2 border-red-100 shadow-sm max-w-lg mx-auto">
        <h3 className="text-2xl font-black text-rose-700">غير مسموح لهذا الحساب!</h3>
        <p className="font-bold text-gray-600">شاشة البيع والمرتجعات مخصصة لموظف المبيعات والكاشير فقط، والمدير مخصص له الرقابة والإدارة والمتابعة والتقارير.</p>
        <a href="/" className="inline-block bg-[#007507] hover:bg-[#006006] text-white font-black px-6 py-2.5 rounded-xl transition-colors">العودة للرئيسية</a>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <div className="p-8 text-center text-red-600 text-xl font-bold">عذراً، لا تملك الصلاحية لدخول هذه الصفحة.</div>;
  }

  return children;
};

export default ProtectedRoute;

