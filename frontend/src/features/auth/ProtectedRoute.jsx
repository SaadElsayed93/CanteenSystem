import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = ({ children, requiredPermission, disallowRoles = [] }) => {
  const { user, loading, hasPermission } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500">جاري التحميل...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (disallowRoles.length > 0 && disallowRoles.includes(user.role?.name)) {
    return (
      <div className="p-12 text-center space-y-4 bg-white rounded-3xl m-8 border-2 border-red-100 shadow-sm max-w-lg mx-auto">
        <h3 className="text-2xl font-black text-rose-700">غير مسموح لهذا الحساب!</h3>
        <p className="font-bold text-gray-600">هذه الشاشة مخصصة لموظف المبيعات والكاشير فقط، والمدير مخصص له الرقابة والإدارة والمتابعة.</p>
        <a href="/" className="inline-block bg-indigo-600 text-white font-black px-6 py-2.5 rounded-xl">العودة للرئيسية</a>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <div className="p-8 text-center text-red-600 text-xl font-bold">عذراً، لا تملك الصلاحية لدخول هذه الصفحة.</div>;
  }

  return children;
};

export default ProtectedRoute;

