import axios from 'axios';
import { getToken } from './auth';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({ baseURL, withCredentials: true });
export const authApi = axios.create({ baseURL, withCredentials: true });

// Set JSON content-type only for plain-object bodies. For FormData (file/folder
// uploads) let the browser set multipart/form-data with the correct boundary —
// forcing application/json corrupts the upload and causes a 500 on the server.
function contentTypeFixer(config: any) {
  const isForm = typeof FormData !== 'undefined' && config.data instanceof FormData;
  config.headers = config.headers || {};
  if (isForm) {
    delete config.headers['Content-Type'];
  } else if (config.data !== undefined && !config.headers['Content-Type']) {
    config.headers['Content-Type'] = 'application/json';
  }
  return config;
}

api.interceptors.request.use(contentTypeFixer);

authApi.interceptors.request.use((config) => {
  contentTypeFixer(config);
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
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
