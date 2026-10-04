import { useState } from 'react';
import api, { getDeviceId } from '../api/axios';
import AuthContext from './auth-context';

function readStoredUser() {
  const storedUser = localStorage.getItem('user');
  if (!storedUser) return null;
  try { return JSON.parse(storedUser); } catch { localStorage.removeItem('user'); return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [loading] = useState(false);

  const establishSession = (data) => {
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('refresh_token', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.tenant?.id) localStorage.setItem('tenant_id', String(data.tenant.id));
    if (data.tenant?.slug) localStorage.setItem('tenant_slug', data.tenant.slug);
    setUser(data.user);
    return data.user;
  };

  const login = async ({ email, password }) => {
    const response = await api.post('/auth/login', { email, password, device_id: getDeviceId() });
    return establishSession(response.data);
  };

  const register = async ({ first_name, last_name, email, password, phone, gender, role = 'RESIDENT' }) => {
    return api.post('/auth/register', { first_name, last_name, email, password, phone, gender, role });
  };

  const onboard = async (payload) => {
    const response = await api.post('/onboarding', { ...payload, device_id: getDeviceId() });
    return establishSession(response.data);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, register, onboard, logout }}>{children}</AuthContext.Provider>;
}
