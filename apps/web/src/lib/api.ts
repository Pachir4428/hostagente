import axios from 'axios';
import { getToken } from './auth';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const authApi = axios.create({
  baseURL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

authApi.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

authApi.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      try {
        const res = await api.post('/auth/refresh');
        const { accessToken } = res.data;
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', accessToken);
        }
        error.config.headers.Authorization = `Bearer ${accessToken}`;
        return authApi.request(error.config);
      } catch {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);
