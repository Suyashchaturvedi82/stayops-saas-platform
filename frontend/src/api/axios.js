import axios from 'axios';

const envBaseUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const normalizedBaseUrl = envBaseUrl
  ? envBaseUrl.endsWith('/api') ? envBaseUrl : `${envBaseUrl}/api`
  : 'http://localhost:3000/api';

const api = axios.create({
  baseURL: normalizedBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

const getDeviceId = () => {
  const existing = localStorage.getItem('device_id');
  if (existing) return existing;
  const value = `web-${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
  localStorage.setItem('device_id', value);
  return value;
};

// Pre-auth calls may carry workspace context headers (login/register/
// onboarding). Authenticated calls NEVER do: tenant_id comes from the JWT.
const PRE_AUTH_PREFIXES = ['/auth/register', '/auth/owner/login', '/auth/tenant/login', '/auth/login', '/onboarding'];

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  const url = config.url || '';
  const isPreAuth = PRE_AUTH_PREFIXES.some((prefix) => url.startsWith(prefix));

  if (token) config.headers.Authorization = `Bearer ${token}`;

  if (isPreAuth) {
    const tenantId = localStorage.getItem('tenant_id');
    const tenantSlug = localStorage.getItem('tenant_slug');
    if (tenantId) config.headers['x-tenant-id'] = tenantId;
    if (tenantSlug) config.headers['x-tenant-slug'] = tenantSlug;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isRefresh = original?.url?.includes('/auth/refresh');

    if (status === 401 && !isRefresh && !original?._retry && localStorage.getItem('refresh_token')) {
      original._retry = true;
      try {
        refreshPromise ||= api.post('/auth/refresh', {
          refresh_token: localStorage.getItem('refresh_token'),
          device_id: getDeviceId(),
        });
        const response = await refreshPromise;
        refreshPromise = null;
        localStorage.setItem('token', response.data.accessToken);
        if (response.data.refreshToken) localStorage.setItem('refresh_token', response.data.refreshToken);
        original.headers.Authorization = `Bearer ${response.data.accessToken}`;
        return api(original);
      } catch (refreshError) {
        refreshPromise = null;
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        if (!['/login', '/login/tenant', '/login/owner', '/register', '/onboarding'].includes(window.location.pathname)) window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    if (status === 401 && !isRefresh) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!['/login', '/login/tenant', '/login/owner', '/register', '/onboarding'].includes(window.location.pathname)) window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export { getDeviceId };
export default api;
