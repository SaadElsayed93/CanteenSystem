import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900" dir="rtl">
        <header className="bg-white shadow p-4 mb-4">
          <h1 className="text-xl font-bold text-center">نظام إدارة الكانتين</h1>
        </header>
        <main className="container mx-auto p-4">
          <Routes>
            <Route path="/" element={<div className="text-center text-xl mt-10">جاري بناء لوحة التحكم...</div>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
