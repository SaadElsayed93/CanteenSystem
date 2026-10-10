import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import LoginPage from './features/auth/LoginPage';
import ProtectedRoute from './features/auth/ProtectedRoute';
import UserManagement from './features/settings/UserManagement';
import ProductsPage from './features/products/ProductsPage';
import SuppliersPage from './features/purchases/SuppliersPage';
import NewPurchasePage from './features/purchases/NewPurchasePage';

function MainLayout({ children }) {
  const { user, logout, hasPermission } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
      <header className="bg-white shadow p-4 mb-4 flex justify-between items-center">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">المنظومة المتكاملة لأدارة الكانتين :__:</h1>
          <nav className="hidden md:flex gap-4">
            <Link to="/" className="text-gray-600 hover:text-blue-600">الرئيسية</Link>
            <Link to="/products" className="text-gray-600 hover:text-blue-600">الأصناف والمخزون</Link>
            {hasPermission('MANAGE_PURCHASES') && (
              <Link to="/purchases/suppliers" className="text-gray-600 hover:text-blue-600">الموردين والمشتريات</Link>
            )}
            {hasPermission('MANAGE_USERS') && (
              <Link to="/settings/users" className="text-gray-600 hover:text-blue-600">المستخدمين</Link>
            )}
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-4">
            <span className="text-sm">مرحباً، {user.fullName}</span>
            <button onClick={logout} className="text-red-600 hover:underline text-sm">تسجيل خروج</button>
          </div>
        )}
      </header>
      <main className="container mx-auto p-4">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout>
                <div className="text-center text-xl mt-10">مرحباً بك في لوحة التحكم</div>
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/products" element={
            <ProtectedRoute>
              <MainLayout>
                <ProductsPage />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/purchases/suppliers" element={
            <ProtectedRoute requiredPermission="MANAGE_PURCHASES">
              <MainLayout>
                <SuppliersPage />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/purchases/new" element={
            <ProtectedRoute requiredPermission="MANAGE_PURCHASES">
              <MainLayout>
                <NewPurchasePage />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/settings/users" element={
            <ProtectedRoute requiredPermission="MANAGE_USERS">
              <MainLayout>
                <UserManagement />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
