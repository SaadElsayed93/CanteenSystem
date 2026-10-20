import React, { useState, useRef } from 'react';
import { useAuth } from './AuthContext';
import { Store, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const form = e.currentTarget;
    const finalUsername = (form.username?.value || usernameRef.current?.value || username || '').trim();
    const finalPassword = form.password?.value || passwordRef.current?.value || password || '';

    if (!finalUsername || !finalPassword) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور');
      setIsLoading(false);
      return;
    }

    try {
      await login(finalUsername, finalPassword);

      // 1. Explicitly prompt Chrome/Edge Password Manager via Credential Management API
      if (typeof window !== 'undefined' && window.PasswordCredential && navigator.credentials) {
        try {
          const cred = new window.PasswordCredential(form);
          await navigator.credentials.store(cred);
        } catch (e1) {
          try {
            const cred = new window.PasswordCredential({
              id: finalUsername,
              password: finalPassword,
              name: finalUsername
            });
            await navigator.credentials.store(cred);
          } catch (e2) {
            console.debug('Credential store fallback error:', e2);
          }
        }
      }

      // 2. Perform top-level document navigation to reliably trigger the browser's "Save Password?" dialog
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ في الاتصال بالخادم أو بيانات الدخول غير صحيحة');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
      <div className="bg-white p-10 rounded-xl shadow-xl w-full max-w-md border-2 border-gray-200">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-100 p-4 rounded-full mb-3">
            <Store className="text-indigo-600" size={40} />
          </div>
          <div className="inline-block bg-indigo-50 text-indigo-900 text-xs font-black px-3.5 py-1 rounded-full mb-2 border border-indigo-200 shadow-sm">
            المستشفى العسكري ق.م بالإسماعيلية
          </div>
          <h2 className="text-2xl font-black text-gray-800">منظومة إدارة الكانتين</h2>
          <p className="text-gray-500 mt-1 text-sm font-bold">تسجيل الدخول لمنظومة الكانتين والخدمات</p>
        </div>
        
        {error && <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded mb-6 text-sm font-bold">{error}</div>}
        
        <form onSubmit={handleSubmit} action="/api/auth/login" method="post" autoComplete="on" className="space-y-5">
          <div>
            <label htmlFor="username" className="block text-gray-700 mb-1.5 font-bold text-sm">اسم المستخدم</label>
            <input 
              ref={usernameRef}
              id="username"
              name="username"
              type="text" 
              autoComplete="username"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
              defaultValue={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="أدخل اسم المستخدم"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-700 mb-1.5 font-bold text-sm">كلمة المرور</label>
            <div className="relative">
              <input 
                ref={passwordRef}
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pl-12"
                defaultValue={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-bold rounded-lg px-4 py-3 hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-4 shadow-lg shadow-indigo-200"
          >
            {isLoading ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
