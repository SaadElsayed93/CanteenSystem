import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { ShiftProvider } from './features/shifts/ShiftContext';
import { ShiftModals } from './features/shifts/ShiftModals';
import LoginPage from './features/auth/LoginPage';
import ProtectedRoute from './features/auth/ProtectedRoute';
import UserManagement from './features/settings/UserManagement';
import HistoryPage from './features/settings/HistoryPage';
import BackupPage from './features/settings/BackupPage';
import ProductsPage from './features/products/ProductsPage';
import SandwichesPage from './features/sandwiches/SandwichesPage';
import SuppliersPage from './features/purchases/SuppliersPage';
import NewPurchasePage from './features/purchases/NewPurchasePage';
import POSPage from './features/pos/POSPage';
import ReturnsPage from './features/pos/ReturnsPage';
import PatientsPage from './features/patients/PatientsPage';
import TreasuryPage from './features/treasury/TreasuryPage';
import ReportsPage from './features/reports/ReportsPage';
import HomePage from './features/home/HomePage';

import { 
  Home, ShoppingCart, RotateCcw, Package, 
  Users, Wallet, Truck, Settings, LogOut, Menu,
  Store, FileText, BarChart2, ShieldCheck, UtensilsCrossed
} from 'lucide-react';

function MainLayout({ children }) {
  const { user, logout, hasPermission, isAdmin } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  const navItems = [
    { to: "/", icon: <Home size={20} />, label: "الرئيسية", exact: true },
    ...((!isAdmin && hasPermission('CREATE_INVOICE')) ? [
      { to: "/pos", icon: <ShoppingCart size={20} />, label: "شاشة البيع (POS)" },
      { to: "/returns", icon: <RotateCcw size={20} />, label: "المرتجعات" }
    ] : []),
    { to: "/products", icon: <Package size={20} />, label: "الأصناف والمخزون" },
    { to: "/sandwiches", icon: <UtensilsCrossed size={20} />, label: "المطبخ والسندوتشات" },
    ...(hasPermission('VIEW_PATIENTS') ? [
      { to: "/patients", icon: <Users size={20} />, label: "المرضى والأرصدة" }
    ] : []),
    ...(hasPermission('VIEW_TREASURY') ? [
      { to: "/treasury", icon: <Wallet size={20} />, label: "الخزينة والمصروفات" }
    ] : []),
    ...(hasPermission('MANAGE_PURCHASES') ? [
      { to: "/purchases/suppliers", icon: <Truck size={20} />, label: "الموردين والمشتريات" }
    ] : []),
    ...(hasPermission('VIEW_REPORTS') ? [
      { to: "/reports", icon: <BarChart2 size={20} />, label: "التقارير والإحصائيات" }
    ] : []),
    ...(hasPermission('MANAGE_USERS') ? [
      { to: "/settings/users", icon: <Settings size={20} />, label: "إدارة المستخدمين" },
      { to: "/settings/history", icon: <FileText size={20} />, label: "سجل الحركات (History)" },
      { to: "/settings/backup", icon: <ShieldCheck size={20} />, label: "النسخ الاحتياطي والأمان" }
    ] : [])
  ];

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-800 overflow-hidden print:overflow-visible print:bg-white print:h-auto" dir="rtl">
      {/* Sidebar - Clean Light Modern Medical Style */}
      <aside className={`print:hidden bg-white text-slate-800 transition-all duration-300 flex flex-col border-l border-slate-200/80 shadow-sm ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="h-16 flex items-center justify-start border-b border-slate-100 px-4 bg-white gap-3">
          <img src="/logo.png" alt="المركز الوطني" className="w-9 h-9 object-contain rounded-full drop-shadow-sm flex-shrink-0" />
          {isSidebarOpen && (
            <div className="leading-tight overflow-hidden text-right">
              <div className="font-black text-xs tracking-tight text-[#003607] truncate">المركز الوطني لعلاج الإدمان</div>
              <div className="text-[10px] text-[#007507] font-black truncate">إدارة الكانتين والبوفيه</div>
            </div>
          )}
        </div>
        
        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-1.5 px-3">
            {navItems.map((item, index) => (
              <li key={index}>
                <NavLink 
                  to={item.to} 
                  end={item.exact}
                  className={({ isActive }) => 
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                      isActive 
                        ? 'bg-[#007507] text-white font-black shadow-sm shadow-emerald-950/20' 
                        : 'text-slate-600 hover:text-[#007507] hover:bg-emerald-50/70 font-bold'
                    }`
                  }
                  title={!isSidebarOpen ? item.label : ""}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {isSidebarOpen && <span className="text-sm">{item.label}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {user && (
          <div className="p-3 border-t border-slate-100 bg-slate-50/80">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-full bg-[#007507] text-white flex items-center justify-center font-black text-sm shadow-sm flex-shrink-0">
                {user.fullName.charAt(0)}
              </div>
              {isSidebarOpen && (
                <div className="overflow-hidden text-right">
                  <div className="font-black text-xs text-slate-800 truncate">{user.fullName}</div>
                  <div className="text-[10px] text-slate-500 font-bold truncate">{user.role} ({user.username})</div>
                </div>
              )}
            </div>
            <button 
              onClick={logout} 
              className={`w-full flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white py-2 rounded-xl text-xs font-black transition-all border border-rose-200/60 cursor-pointer ${!isSidebarOpen && 'px-0'}`}
              title="تسجيل خروج"
            >
              <LogOut size={16} />
              {isSidebarOpen && <span>تسجيل الخروج</span>}
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="print:hidden h-16 bg-white border-b border-slate-200/80 shadow-xs flex items-center px-5 justify-between">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-[#007507] transition-colors focus:outline-none cursor-pointer"
          >
            <Menu size={22} />
          </button>
          
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="شعار المركز" className="w-8 h-8 object-contain rounded-full shadow-xs" />
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-slate-900 font-black text-xs">المركز الوطني لعلاج الإدمان - المستشفى العسكري ق.م بالإسماعيلية</span>
              <span className="text-slate-500 font-bold text-[10px]">منظومة إدارة الكانتين والبوفيه والخدمات</span>
            </div>
            <span className="bg-emerald-50 text-[#007507] font-black text-xs px-2.5 py-1 rounded-full border border-emerald-200 shadow-xs">
              الكانتين
            </span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f8fafc] p-6 print:overflow-visible print:bg-white print:p-0">
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
      <Toaster position="top-center" reverseOrder={false} toastOptions={{ className: 'font-bold font-sans text-right' }} />
      <AuthProvider>
        <ShiftProvider>
          <ShiftModals />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout>
                <HomePage />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/pos" element={
            <ProtectedRoute requiredPermission="CREATE_INVOICE" disallowAdmin={true} disallowRoles={['أدمن', 'مدير', 'ADMIN']}>
              <MainLayout>
                <POSPage />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/returns" element={
            <ProtectedRoute requiredPermission="CREATE_INVOICE" disallowAdmin={true} disallowRoles={['أدمن', 'مدير', 'ADMIN']}>
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

          <Route path="/sandwiches" element={
            <ProtectedRoute>
              <MainLayout>
                <SandwichesPage />
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

          <Route path="/reports" element={
            <ProtectedRoute requiredPermission="VIEW_REPORTS">
              <MainLayout>
                <ReportsPage />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/settings/history" element={<ProtectedRoute requiredPermission="MANAGE_USERS"><MainLayout><HistoryPage /></MainLayout></ProtectedRoute>} />

          <Route path="/settings/users" element={
            <ProtectedRoute requiredPermission="MANAGE_USERS">
              <MainLayout>
                <UserManagement />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/settings/backup" element={
            <ProtectedRoute requiredPermission="MANAGE_USERS">
              <MainLayout>
                <BackupPage />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ShiftProvider>
    </AuthProvider>
    </BrowserRouter>
  );
}

export default App;



