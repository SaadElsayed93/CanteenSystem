import React, { createContext, useContext, useState, useEffect } from 'react';
import client from '../../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await client.get('/auth/me');
      setUser(response.data.data);
    } catch (error) {
      console.error(error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const response = await client.post('/auth/login', { username, password });
    const { token, user: userData } = response.data.data;
    localStorage.setItem('token', token);
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete client.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const hasPermission = (perm) => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes('ALL') || user.permissions.includes(perm);
  };

  const roleName = typeof user?.role === 'string' ? user.role : user?.role?.name;
  const isAdmin = Boolean(
    user && (
      roleName === 'مدير' || 
      roleName === 'أدمن' || 
      roleName === 'ADMIN' || 
      user?.permissions?.includes('ALL') || 
      user?.username === 'admin'
    )
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasPermission, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

