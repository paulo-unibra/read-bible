import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token em todas as requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para tratar erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.url !== '/admin/login') {
      // Token expirado ou inválido
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      const appBase = import.meta.env.BASE_URL.replace(/\/$/, '');
      window.location.href = `${appBase}/login`;
    }
    return Promise.reject(error);
  }
);

export default api;
