import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import LoginPage from './features/auth/LoginPage';
import ProtectedRoute from './features/auth/ProtectedRoute';
import UserManagement from './features/settings/UserManagement';
import ProductsPage from './features/products/ProductsPage';
import SuppliersPage from './features/purchases/SuppliersPage';
import NewPurchasePage from './features/purchases/NewPurchasePage';
import POSPage from './features/pos/POSPage';
import ReturnsPage from './features/pos/ReturnsPage';
import PatientsPage from './features/patients/PatientsPage';
import TreasuryPage from './features/treasury/TreasuryPage';

import { 
  Home, ShoppingCart, RotateCcw, Package, 
  Users, Wallet, Truck, Settings, LogOut, Menu,
  Store
} from 'lucide-react';

function MainLayout({ children }) {
  const { user, logout, hasPermission } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const navItems = [
    { to: "/", icon: <Home size={20} />, label: "الرئيسية", exact: true },
    ...(hasPermission('CREATE_INVOICE') ? [
      { to: "/pos", icon: <ShoppingCart size={20} />, label: "شاشة البيع (POS)" },
      { to: "/returns", icon: <RotateCcw size={20} />, label: "المرتجعات" }
    ] : []),
    { to: "/products", icon: <Package size={20} />, label: "الأصناف والمخزون" },
    ...(hasPermission('VIEW_PATIENTS') ? [
      { to: "/patients", icon: <Users size={20} />, label: "المرضى والأرصدة" }
    ] : []),
    ...(hasPermission('VIEW_TREASURY') ? [
      { to: "/treasury", icon: <Wallet size={20} />, label: "الخزينة والمصروفات" }
    ] : []),
    ...(hasPermission('MANAGE_PURCHASES') ? [
      { to: "/purchases/suppliers", icon: <Truck size={20} />, label: "الموردين والمشتريات" }
    ] : []),
    ...(hasPermission('MANAGE_USERS') ? [
      { to: "/settings/users", icon: <Settings size={20} />, label: "إدارة المستخدمين" }
    ] : [])
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-800 overflow-hidden" dir="rtl">
      {/* Sidebar */}
      <aside className={`bg-indigo-900 text-white transition-all duration-300 flex flex-col ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center justify-center border-b border-indigo-800 px-4">
          <Store className="text-indigo-300" size={32} />
          {isSidebarOpen && <span className="mr-3 font-bold text-xl tracking-wide">الكانتين</span>}
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-2 px-3">
            {navItems.map((item, index) => (
              <li key={index}>
                <NavLink 
                  to={item.to} 
                  end={item.exact}
                  className={({ isActive }) => 
                    `flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                      isActive ? 'bg-indigo-700 text-white font-bold' : 'hover:bg-indigo-800 text-indigo-100'
                    }`
                  }
                  title={!isSidebarOpen ? item.label : ""}
                >
                  <span className="text-indigo-200">{item.icon}</span>
                  {isSidebarOpen && <span>{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {user && (
          <div className="p-4 border-t border-indigo-800">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-700 flex items-center justify-center font-bold text-lg">
                {user.fullName.charAt(0)}
              </div>
              {isSidebarOpen && (
                <div className="overflow-hidden">
                  <div className="font-bold truncate">{user.fullName}</div>
                  <div className="text-xs text-indigo-300 truncate">{user.username}</div>
                </div>
              )}
            </div>
            <button 
              onClick={logout} 
              className={`w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-colors ${!isSidebarOpen && 'px-0'}`}
              title="تسجيل خروج"
            >
              <LogOut size={18} />
              {isSidebarOpen && <span>خروج</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white shadow-sm flex items-center px-4 justify-between">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none"
          >
            <Menu size={24} />
          </button>
          
          <div className="font-bold text-gray-700">
            نظام إدارة الكانتين المتكامل
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
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

          <Route path="/pos" element={
            <ProtectedRoute requiredPermission="CREATE_INVOICE">
              <MainLayout>
                <POSPage />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/returns" element={
            <ProtectedRoute requiredPermission="CREATE_INVOICE">
              <MainLayout>
                <ReturnsPage />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/patients" element={
            <ProtectedRoute requiredPermission="VIEW_PATIENTS">
              <MainLayout>
                <PatientsPage />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/treasury" element={
            <ProtectedRoute requiredPermission="VIEW_TREASURY">
              <MainLayout>
                <TreasuryPage />
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
