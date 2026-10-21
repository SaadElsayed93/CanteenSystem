import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';
    // If accessed directly on port 8000 (single-port unified setup)
    if (window.location.port === '8000') {
      return '/api';
    }
    // If accessed via dev server or another port, target port 8000 on the same machine
    return `${protocol}//${hostname}:8000/api`;
  }
  return 'http://localhost:8000/api';
};

const client = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // If using cookies/sessions
});

// Interceptor لمعالجة انقطاع الاتصال والأخطاء
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // لا يوجد رد من السيرفر (انقطاع الاتصال)
      console.error('Network Error - No response from server');
      // يمكن هنا إطلاق حدث (event) لإظهار تنبيه للمستخدم
      return Promise.reject(new Error('انقطع الاتصال بالسيرفر. يرجى المحاولة لاحقاً.'));
    }
    return Promise.reject(error);
  }
);

export default client;
