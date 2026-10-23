import axios from 'axios';

const getBaseURL = () => {
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';
    const port = window.location.port;

    // When served by backend (port 8000, 80, 443, or default port)
    // Relative '/api' works on ANY IP, ANY device, and ANY network automatically!
    if (port === '8000' || !port || port === '80' || port === '443') {
      return '/api';
    }

    // In Vite dev server mode (e.g. port 5173), target backend on the same machine
    return `${protocol}//${hostname}:8000/api`;
  }
  return '/api';
};

const client = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interceptor لمعالجة انقطاع الاتصال والأخطاء
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error('Network Error - No response from server:', error);
      return Promise.reject(new Error('انقطع الاتصال بالسيرفر. يرجى التأكد من اتصالك بالشبكة.'));
    }
    return Promise.reject(error);
  }
);

export default client;
