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
    <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl">
      <div className="bg-white p-8 sm:p-10 rounded-3xl shadow-xl w-full max-w-md border border-slate-200/80">
        <div className="flex flex-col items-center mb-6 text-center">
          <img 
            src="/logo.png" 
            alt="المركز الوطني لعلاج الإدمان" 
            className="w-24 h-24 object-contain mb-3 drop-shadow-md rounded-full bg-white p-1 border border-slate-100" 
          />
          <div className="inline-block bg-emerald-50 text-[#007507] text-xs font-black px-3.5 py-1 rounded-full mb-1.5 border border-emerald-200/80 shadow-xs">
            المركز الوطني لعلاج الإدمان
          </div>
          <h2 className="text-xl font-black text-slate-900">منظومة إدارة الكانتين والبوفيه</h2>
          <p className="text-slate-500 mt-1 text-xs font-bold">المستشفى العسكري ق.م بالإسماعيلية</p>
        </div>
        
        {error && <div className="bg-red-50 border-r-4 border-red-500 text-red-700 p-3.5 rounded-xl mb-5 text-xs font-black">{error}</div>}
        
        <form onSubmit={handleSubmit} action="/api/auth/login" method="post" autoComplete="on" className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-slate-700 mb-1.5 font-bold text-xs">اسم المستخدم</label>
            <input 
              ref={usernameRef}
              id="username"
              name="username"
              type="text" 
              autoComplete="username"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#007507] focus:border-transparent transition-all font-bold text-sm bg-slate-50/50 focus:bg-white" 
              defaultValue={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="أدخل اسم المستخدم"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-slate-700 mb-1.5 font-bold text-xs">كلمة المرور</label>
            <div className="relative">
              <input 
                ref={passwordRef}
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-[#007507] focus:border-transparent transition-all pl-12 font-bold text-sm bg-slate-50/50 focus:bg-white"
                defaultValue={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-[#007507] hover:bg-[#003607] text-white font-black rounded-xl px-4 py-3.5 transition-all disabled:opacity-50 mt-2 shadow-md shadow-emerald-950/20 text-sm cursor-pointer"
          >
            {isLoading ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
