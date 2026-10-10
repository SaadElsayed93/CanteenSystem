import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://192.168.1.32:8000/api',
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
